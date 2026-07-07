import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { throwApi } from '../common/exceptions/api.exception';
import { RedisCacheService } from '../redis/services/redis-cache.service';
import { AppNotificationsService } from '../queue/services/app-notifications.service';
import type { JwtPayload } from '../common/types/jwt-payload.interface';
import {
  CreateCommentDto,
  CreatePostDto,
  ListPostsQueryDto,
  UpdatePostDto,
} from './dto/posts.dto';
import { PostsRepository } from './repositories/posts.repository';
import { notDeleted } from '../common/utils/soft-delete.util';

const PAGE_SIZE = 20;

type PostWithCount = Awaited<ReturnType<PostsRepository['findFeed']>>[number];

@Injectable()
export class PostsService {
  constructor(
    private readonly repo: PostsRepository,
    private readonly cache: RedisCacheService,
    private readonly notifications: AppNotificationsService,
  ) {}

  private mapPost(post: PostWithCount, liked: boolean, reposted: boolean) {
    const { _count, ...rest } = post;
    return {
      ...rest,
      likesCount: _count.likes,
      repostsCount: _count.reposts,
      commentsCount: _count.comments,
      liked,
      reposted,
    };
  }

  async getFeed(query: ListPostsQueryDto, user?: JwtPayload) {
    const { cursor, userId: authorId } = query;

    const cacheKey = authorId
      ? `posts:user:${authorId}:${cursor || 'first'}`
      : `posts:feed:${cursor || 'first'}`;

    const cached = await this.cache.get<{
      posts: unknown[];
      nextCursor: string | null;
      hasMore: boolean;
    }>(cacheKey);
    if (cached) return cached;

    const where: Prisma.PostWhereInput = authorId
      ? { authorId, ...notDeleted, isHidden: false }
      : { ...notDeleted, isHidden: false };
    const posts = await this.repo.findFeed({
      where,
      take: PAGE_SIZE + 1,
      cursor,
    });

    const hasMore = posts.length > PAGE_SIZE;
    const items = hasMore ? posts.slice(0, -1) : posts;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    let likedPostIds = new Set<string>();
    let repostedPostIds = new Set<string>();
    if (user?.userId && items.length > 0) {
      const postIds = items.map((p) => p.id);
      const [likes, reposts] = await Promise.all([
        this.repo.findLikesByUser(user.userId, postIds),
        this.repo.findRepostsByUser(user.userId, postIds),
      ]);
      likedPostIds = new Set(likes.map((l) => l.postId));
      repostedPostIds = new Set(reposts.map((r) => r.postId));
    }

    const postsWithMeta = items.map((p) =>
      this.mapPost(p, likedPostIds.has(p.id), repostedPostIds.has(p.id)),
    );

    const result = { posts: postsWithMeta, nextCursor, hasMore };
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async createPost(user: JwtPayload, dto: CreatePostDto) {
    const post = await this.repo.create({
      ...dto,
      author: { connect: { id: user.userId } },
    });

    const followers = await this.repo.findFollowerIds(user.userId);
    if (followers.length > 0) {
      await this.notifications.notifyUsers(
        followers.map((f) => f.followerId),
        {
          type: 'system',
          titleAr: 'منشور جديد',
          bodyAr: `${post.author.arabicName} نشر منشوراً جديداً`,
          data: { postId: post.id, authorId: user.userId },
        },
      );
    }

    await this.cache.del('posts:feed:first');
    return post;
  }

  async getPost(id: string, user?: JwtPayload) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const post = await this.repo.findById(id);
    if (!post) throwApi(404, 'not_found', 'المنشور غير موجود');

    let liked = false;
    let reposted = false;
    if (user?.userId) {
      const [likeRow, repostRow] = await Promise.all([
        this.repo.findLike(id, user.userId),
        this.repo.findRepost(id, user.userId),
      ]);
      liked = !!likeRow;
      reposted = !!repostRow;
    }

    return this.mapPost(post, liked, reposted);
  }

  async updatePost(user: JwtPayload, id: string, dto: UpdatePostDto) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const post = await this.repo.findOwnerMeta(id);
    if (!post) throwApi(404, 'not_found', 'المنشور غير موجود');
    if (post.authorId !== user.userId && user.role !== 'ADMIN') {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    const updated = await this.repo.update(id, dto);
    await this.invalidatePostCaches(id, post.authorId);
    return updated;
  }

  async deletePost(user: JwtPayload, id: string) {
    if (!id) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const post = await this.repo.findOwnerMeta(id);
    if (!post) throwApi(404, 'not_found', 'المنشور غير موجود');
    if (post.authorId !== user.userId && user.role !== 'ADMIN') {
      throwApi(403, 'forbidden', 'غير مسموح');
    }

    await this.repo.softDelete(id);
    await this.invalidatePostCaches(id, post.authorId);
    return { deleted: true };
  }

  async toggleLike(user: JwtPayload, postId: string) {
    if (!postId) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const post = await this.repo.findOwnerMeta(postId);
    if (!post) throwApi(404, 'not_found', 'المنشور غير موجود');

    const existing = await this.repo.findLike(postId, user.userId);
    const liked = await this.repo.toggleLike(postId, user.userId, !!existing);

    if (liked && post.authorId !== user.userId) {
      void this.notifications
        .notifyUser({
          userId: post.authorId,
          type: 'like',
          titleAr: 'إعجاب جديد',
          bodyAr: `أعجب ${user.username} بمنشورك`,
          data: { postId },
        })
        .catch(() => {});
    }

    await this.cache.del(this.cache.keys.post(postId));
    return { liked };
  }

  async toggleRepost(user: JwtPayload, postId: string) {
    if (!postId) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const post = await this.repo.findOwnerMeta(postId);
    if (!post) throwApi(404, 'not_found', 'المنشور غير موجود');

    const existing = await this.repo.findRepost(postId, user.userId);
    const reposted = await this.repo.toggleRepost(
      postId,
      user.userId,
      !!existing,
    );

    if (reposted && post.authorId !== user.userId) {
      void this.notifications
        .notifyUser({
          userId: post.authorId,
          type: 'repost',
          titleAr: 'إعادة نشر',
          bodyAr: `أعاد ${user.username} نشر منشورك`,
          data: { postId },
        })
        .catch(() => {});
    }

    await this.cache.del(this.cache.keys.post(postId));
    await this.cache.del('posts:feed:first');
    return { reposted };
  }

  async listComments(postId: string) {
    if (!postId) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const post = await this.repo.findOwnerMeta(postId);
    if (!post) throwApi(404, 'not_found', 'المنشور غير موجود');

    const comments = await this.repo.findComments(postId);
    return { comments };
  }

  async createComment(user: JwtPayload, postId: string, dto: CreateCommentDto) {
    if (!postId) throwApi(400, 'invalid_id', 'معرّف غير صالح');

    const post = await this.repo.findOwnerMeta(postId);
    if (!post) throwApi(404, 'not_found', 'المنشور غير موجود');

    const comment = await this.repo.createComment(
      postId,
      user.userId,
      dto.content,
    );

    if (post.authorId !== user.userId) {
      void this.notifications
        .notifyUser({
          userId: post.authorId,
          type: 'comment',
          titleAr: 'تعليق جديد',
          bodyAr: `علّق ${user.username} على منشورك`,
          data: { postId, commentId: comment.id },
        })
        .catch(() => {});
    }

    await this.cache.del(this.cache.keys.post(postId));
    await this.cache.del('posts:feed:first');
    return comment;
  }

  private async invalidatePostCaches(postId: string, authorId: string) {
    await this.cache.del(this.cache.keys.post(postId));
    await this.cache.del('posts:feed:first');
    await this.cache.del(`posts:user:${authorId}:first`);
  }
}
