import { Injectable } from '@nestjs/common';
import { Country, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { softDeleteFields } from '../../common/utils/soft-delete.util';

const listUserSelect = {
  id: true,
  username: true,
  displayName: true,
  arabicName: true,
  avatar: true,
  verified: true,
  bio: true,
  country: true,
  _count: {
    select: { followers: true },
  },
} satisfies Prisma.UserSelect;

const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  arabicName: true,
  avatar: true,
  coverImage: true,
  bio: true,
  verified: true,
  country: true,
  role: true,
  rating: true,
  reviewCount: true,
  createdAt: true,
  lastSeenAt: true,
  butcherProfile: {
    select: { id: true },
  },
  _count: {
    select: { followers: true, following: true, listings: true, posts: true },
  },
} satisfies Prisma.UserSelect;

const connectionUserSelect = {
  id: true,
  username: true,
  displayName: true,
  arabicName: true,
  avatar: true,
  verified: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveUsers(search?: string) {
    const where: Prisma.UserWhereInput = { isActive: true };
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { arabicName: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: listUserSelect,
    });
  }

  findUserProfile(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: profileSelect,
    });
  }

  findFollow(followerId: string, followingId: string) {
    return this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
      select: { id: true },
    });
  }

  findByUsername(username: string, excludeUserId?: string) {
    return this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });
  }

  updateUser(
    id: string,
    data: {
      username?: string;
      displayName?: string;
      arabicName?: string;
      bio?: string;
      avatar?: string;
      coverImage?: string;
      country?: Country;
      fcmToken?: string | null;
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        arabicName: true,
        avatar: true,
        coverImage: true,
        bio: true,
        verified: true,
        country: true,
        rating: true,
        reviewCount: true,
        _count: {
          select: { followers: true, following: true },
        },
      },
    });
  }

  deactivateUser(id: string) {
    return this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          ...softDeleteFields(),
          email: `deleted_${Date.now()}@safat.deleted`,
          fcmToken: null,
        },
      }),
      this.prisma.userSession.deleteMany({ where: { userId: id } }),
    ]);
  }

  findUserById(id: string, select: Prisma.UserSelect) {
    return this.prisma.user.findUnique({ where: { id }, select });
  }

  findActiveUserId(id: string) {
    return this.prisma.user.findFirst({
      where: { id, isActive: true, deletedAt: null },
      select: { id: true },
    });
  }

  deleteFollow(followerId: string, followingId: string) {
    return this.prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId } },
    });
  }

  createFollow(followerId: string, followingId: string) {
    return this.prisma.follow.create({
      data: { followerId, followingId },
    });
  }

  findFollowers(id: string, take: number) {
    return this.prisma.follow.findMany({
      where: { followingId: id },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        follower: { select: connectionUserSelect },
      },
    });
  }

  findFollowing(id: string, take: number) {
    return this.prisma.follow.findMany({
      where: { followerId: id },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        following: { select: connectionUserSelect },
      },
    });
  }

  findFollowsByViewer(viewerId: string, followingIds: string[]) {
    return this.prisma.follow.findMany({
      where: {
        followerId: viewerId,
        followingId: { in: followingIds },
      },
      select: { followingId: true },
    });
  }

  findUserRating(targetId: string, reviewerId: string) {
    return this.prisma.userReview.findUnique({
      where: { targetId_reviewerId: { targetId, reviewerId } },
      select: { rating: true },
    });
  }

  upsertUserRating(targetId: string, reviewerId: string, rating: number) {
    return this.prisma.userReview.upsert({
      where: { targetId_reviewerId: { targetId, reviewerId } },
      update: { rating },
      create: { targetId, reviewerId, rating },
    });
  }

  aggregateUserRating(targetId: string) {
    return this.prisma.userReview.aggregate({
      where: { targetId },
      _avg: { rating: true },
      _count: { rating: true },
    });
  }

  updateUserRatingCache(targetId: string, rating: number, reviewCount: number) {
    return this.prisma.user.update({
      where: { id: targetId },
      data: { rating, reviewCount },
      select: { id: true },
    });
  }
}
