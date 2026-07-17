import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { LoggerService } from '../../common/services/logger.service';
import { SocketDisconnectService } from '../../gateway/services/socket-disconnect.service';
import { throwApi } from '../../common/exceptions/api.exception';
import { AppNotificationsService } from '../../queue/services/app-notifications.service';
import type { JwtPayload } from '../../common/types/jwt-payload.interface';
import { UsersRepository } from '../repositories/users.repository';
import {
  ConnectionsQueryDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from '../dto/users.dto';

const MIN_RATING = 1;
const MAX_RATING = 5;

const PAGE_SIZE = 50;
const PROFILE_CACHE_TTL = 300;

type ProfileUser = NonNullable<
  Awaited<ReturnType<UsersRepository['findUserProfile']>>
>;

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
    private readonly socketDisconnect: SocketDisconnectService,
    private readonly notifications: AppNotificationsService,
  ) {}

  async listUsers(query: ListUsersQueryDto) {
    const users = await this.repo.findActiveUsers(query.search);
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      arabicName: u.arabicName,
      avatar: u.avatar,
      verified: u.verified,
      bio: u.bio,
      country: u.country,
      followers: u._count.followers,
    }));
  }

  async getUser(id: string, viewer?: JwtPayload) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    // Cache shared profile fields only — never cache viewer-specific isFollowing
    // Key versioned so stale entries that baked in isFollowing are ignored
    const cacheKey = `user:${id}:base`;
    let base = await this.redis.cacheGet<Record<string, unknown>>(cacheKey);
    if (!base) {
      const user = await this.repo.findUserProfile(id);
      if (!user) throwApi(404, 'not_found', 'المستخدم غير موجود');
      base = this.formatProfile(user);
      await this.redis.cacheSet(cacheKey, base, PROFILE_CACHE_TTL);
    }

    let isFollowing = false;
    let myRating: number | null = null;
    if (viewer?.userId && viewer.userId !== id) {
      const [follow, review] = await Promise.all([
        this.repo.findFollow(viewer.userId, id),
        this.repo.findUserRating(id, viewer.userId),
      ]);
      isFollowing = !!follow;
      myRating = review?.rating ?? null;
      this.logger.debug(
        {
          viewerId: viewer.userId,
          profileUserId: id,
          isFollowing,
          followRecordId: follow?.id ?? null,
        },
        'Profile follow state resolved from database',
      );
    } else {
      this.logger.debug(
        {
          viewerId: viewer?.userId ?? null,
          profileUserId: id,
          isFollowing: false,
          reason: viewer?.userId === id ? 'self_profile' : 'anonymous_viewer',
        },
        'Profile follow state resolved without relationship lookup',
      );
    }

    return { ...base, isFollowing, myRating };
  }

  async updateUser(id: string, user: JwtPayload, dto: UpdateUserDto) {
    if (id !== user.userId && user.role !== 'ADMIN') {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    if (dto.username) {
      const conflict = await this.repo.findByUsername(dto.username, id);
      if (conflict) {
        throwApi(409, 'username_taken', 'اسم المستخدم مستخدم بالفعل');
      }
    }

    try {
      const { fcmToken, ...profileData } = dto;
      const updated = await this.repo.updateUser(id, {
        ...profileData,
        ...(fcmToken !== undefined ? { fcmToken } : {}),
      });

      await this.redis.cacheDel(`user:${id}`, `user:${id}:base`);
      this.logger.info({ userId: id }, 'User profile updated');

      return {
        id: updated.id,
        username: updated.username,
        displayName: updated.displayName,
        arabicName: updated.arabicName,
        avatar: updated.avatar,
        coverImage: updated.coverImage,
        bio: updated.bio,
        verified: updated.verified,
        country: updated.country,
        rating: updated.reviewCount > 0 ? updated.rating : null,
        reviewCount: updated.reviewCount,
        followersCount: updated._count.followers,
        followingCount: updated._count.following,
      };
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') {
        throwApi(409, 'username_taken', 'اسم المستخدم مستخدم بالفعل');
      }
      throw err;
    }
  }

  async deleteUser(id: string, user: JwtPayload) {
    if (id !== user.userId && user.role !== 'ADMIN') {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    await this.repo.deactivateUser(id);
    await this.socketDisconnect.disconnectUser(id);
    await this.redis.cacheDel(`user:${id}`, `user:${id}:base`);
    this.logger.info(
      { userId: id, by: user.userId },
      'User account deactivated',
    );
    return { deleted: true };
  }

  async setFollow(targetId: string, followerId: string, following: boolean) {
    if (targetId === followerId) {
      throwApi(400, 'invalid_action', 'لا يمكنك متابعة نفسك');
    }

    const target = await this.repo.findUserById(targetId, {
      id: true,
      arabicName: true,
    });
    if (!target) throwApi(404, 'not_found', 'المستخدم غير موجود');

    const existing = await this.repo.findFollow(followerId, targetId);
    if (!following) {
      if (existing) {
        await this.repo.deleteFollow(followerId, targetId);
      }
      await this.invalidateFollowProfiles(followerId, targetId);
      this.logger.info(
        {
          followerId,
          targetId,
          following: false,
          deletedFollowId: existing?.id ?? null,
          changed: !!existing,
        },
        'User follow state persisted and profile caches invalidated',
      );
      return { following: false };
    }

    const created = await this.repo.upsertFollow(followerId, targetId);

    // Only send a notification when a relationship was newly created.
    if (!existing) {
      const follower = await this.repo.findUserById(followerId, {
        arabicName: true,
        avatar: true,
      });

      void this.notifications.notifyUser({
        userId: targetId,
        type: 'follow',
        titleAr: 'متابع جديد',
        bodyAr: `${follower?.arabicName || 'مستخدم'} بدأ متابعتك`,
        data: { actorId: followerId, actorAvatar: follower?.avatar },
      });
    }

    await this.invalidateFollowProfiles(followerId, targetId);
    this.logger.info(
      {
        followerId,
        targetId,
        following: true,
        followRecordId: created.id,
        changed: !existing,
      },
      'User follow state persisted and profile caches invalidated',
    );
    return { following: true };
  }

  private invalidateFollowProfiles(followerId: string, targetId: string) {
    return this.redis.cacheDel(
      `user:${followerId}`,
      `user:${followerId}:base`,
      `user:${targetId}`,
      `user:${targetId}:base`,
    );
  }

  async getConnections(
    id: string,
    query: ConnectionsQueryDto,
    viewer?: JwtPayload,
  ) {
    const type = query.type ?? 'followers';

    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');
    if (type !== 'followers' && type !== 'following') {
      throwApi(400, 'invalid_type', 'نوع القائمة غير صالح');
    }

    const target = await this.repo.findActiveUserId(id);
    if (!target) throwApi(404, 'not_found', 'المستخدم غير موجود');

    const rows =
      type === 'followers'
        ? await this.repo.findFollowers(id, PAGE_SIZE)
        : await this.repo.findFollowing(id, PAGE_SIZE);

    const users = rows.map((row) =>
      'follower' in row ? row.follower : row.following,
    );

    let followingSet = new Set<string>();
    if (viewer?.userId && users.length > 0) {
      const myFollows = await this.repo.findFollowsByViewer(
        viewer.userId,
        users.map((u) => u.id),
      );
      followingSet = new Set(myFollows.map((f) => f.followingId));
    }

    this.logger.debug(
      {
        profileUserId: id,
        viewerId: viewer?.userId ?? null,
        connectionType: type,
        resultCount: users.length,
        viewerFollowingCount: followingSet.size,
      },
      'Connection follow states resolved from database',
    );

    return {
      type,
      users: users.map((u) => ({
        ...u,
        isFollowing: viewer?.userId === u.id ? false : followingSet.has(u.id),
      })),
    };
  }

  private resolveAccountType(
    user: ProfileUser,
  ): 'USER' | 'BUTCHER' | 'LIVESTOCK_TRADER' {
    if (user.role === 'BUTCHER' || user.butcherProfile) return 'BUTCHER';
    if (user._count.listings > 0) return 'LIVESTOCK_TRADER';
    return 'USER';
  }

  private formatProfile(user: ProfileUser) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      arabicName: user.arabicName,
      avatar: user.avatar,
      coverImage: user.coverImage,
      bio: user.bio,
      verified: user.verified,
      country: user.country,
      role: user.role,
      accountType: this.resolveAccountType(user),
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
      rating: user.reviewCount > 0 ? user.rating : null,
      reviewCount: user.reviewCount,
      followersCount: user._count.followers,
      followingCount: user._count.following,
      listingsCount: user._count.listings,
      postsCount: user._count.posts,
    };
  }

  /** Rate another user's account (1–5). One review per reviewer, editable. */
  async rateUser(targetId: string, reviewerId: string, rating: number) {
    if (targetId === reviewerId) {
      throwApi(400, 'invalid_action', 'لا يمكنك تقييم حسابك الخاص');
    }
    if (
      !Number.isInteger(rating) ||
      rating < MIN_RATING ||
      rating > MAX_RATING
    ) {
      throwApi(400, 'invalid_rating', 'التقييم يجب أن يكون بين 1 و 5');
    }

    const target = await this.repo.findActiveUserId(targetId);
    if (!target) throwApi(404, 'not_found', 'المستخدم غير موجود');

    await this.repo.upsertUserRating(targetId, reviewerId, rating);

    const agg = await this.repo.aggregateUserRating(targetId);
    const avg = agg._avg.rating ?? 0;
    const count = agg._count.rating;
    await this.repo.updateUserRatingCache(targetId, avg, count);
    await this.redis.cacheDel(`user:${targetId}`, `user:${targetId}:base`);

    this.logger.info({ targetId, reviewerId, rating }, 'User account rated');

    return {
      rating: count > 0 ? avg : null,
      reviewCount: count,
      myRating: rating,
    };
  }
}
