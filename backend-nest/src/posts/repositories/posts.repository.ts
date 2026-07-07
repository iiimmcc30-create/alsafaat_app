import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { notDeleted, softDeleteFields } from '../../common/utils/soft-delete.util';

export const POST_AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  arabicName: true,
  avatar: true,
  verified: true,
} as const;

const POST_INCLUDE = {
  author: { select: POST_AUTHOR_SELECT },
  _count: { select: { likes: true, reposts: true, comments: true } },
} as const;

@Injectable()
export class PostsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findFeed(params: {
    where: Prisma.PostWhereInput;
    take: number;
    cursor?: string;
  }) {
    return this.prisma.post.findMany({
      where: params.where,
      take: params.take,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      orderBy: { createdAt: 'desc' },
      include: POST_INCLUDE,
    });
  }

  findLikesByUser(userId: string, postIds: string[]) {
    return this.prisma.postLike.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
  }

  findRepostsByUser(userId: string, postIds: string[]) {
    return this.prisma.postRepost.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
  }

  create(data: Prisma.PostCreateInput) {
    return this.prisma.post.create({
      data,
      include: { author: { select: POST_AUTHOR_SELECT } },
    });
  }

  findFollowerIds(userId: string) {
    return this.prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
      take: 500,
    });
  }

  findById(id: string) {
    return this.prisma.post.findFirst({
      where: { id, ...notDeleted },
      include: POST_INCLUDE,
    });
  }

  findOwnerMeta(id: string) {
    return this.prisma.post.findFirst({
      where: { id, ...notDeleted },
      select: { id: true, authorId: true },
    });
  }

  update(id: string, data: Prisma.PostUpdateInput) {
    return this.prisma.post.update({
      where: { id },
      data,
      include: { author: { select: POST_AUTHOR_SELECT } },
    });
  }

  softDelete(id: string) {
    return this.prisma.post.update({
      where: { id },
      data: { ...softDeleteFields(), isHidden: true },
    });
  }

  findLike(postId: string, userId: string) {
    return this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { id: true },
    });
  }

  findRepost(postId: string, userId: string) {
    return this.prisma.postRepost.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { id: true },
    });
  }

  toggleLike(postId: string, userId: string, existing: boolean) {
    return this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.postLike.delete({
          where: { postId_userId: { postId, userId } },
        });
        await tx.post.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
        });
        return false;
      }
      await tx.postLike.create({ data: { postId, userId } });
      await tx.post.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
      });
      return true;
    });
  }

  toggleRepost(postId: string, userId: string, existing: boolean) {
    return this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.postRepost.delete({
          where: { postId_userId: { postId, userId } },
        });
        await tx.post.update({
          where: { id: postId },
          data: { repostsCount: { decrement: 1 } },
        });
        return false;
      }
      await tx.postRepost.create({ data: { postId, userId } });
      await tx.post.update({
        where: { id: postId },
        data: { repostsCount: { increment: 1 } },
      });
      return true;
    });
  }

  findComments(postId: string) {
    return this.prisma.postComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { author: { select: POST_AUTHOR_SELECT } },
    });
  }

  createComment(postId: string, authorId: string, content: string) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.postComment.create({
        data: { postId, authorId, content },
        include: { author: { select: POST_AUTHOR_SELECT } },
      });
      await tx.post.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      });
      return created;
    });
  }
}
