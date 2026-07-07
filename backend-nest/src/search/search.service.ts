import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { notDeleted } from '../common/utils/soft-delete.util';

const HASHTAG_RE = /#[\u0600-\u06FF\w_]+/g;

@Injectable()
export class SearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRecentPosts(since: Date) {
    return this.prisma.post.findMany({
      where: { createdAt: { gte: since }, ...notDeleted, isHidden: false },
      select: { content: true, arabicContent: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });
  }
}

@Injectable()
export class SearchService {
  constructor(private readonly repo: SearchRepository) {}

  async getTrending() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const posts = await this.repo.findRecentPosts(since);

    const counts = new Map<string, number>();
    for (const post of posts) {
      const text = `${post.content} ${post.arabicContent}`;
      const matches = text.match(HASHTAG_RE) ?? [];
      for (const tag of matches) {
        const normalized = tag.toLowerCase();
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }

    const trending = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return { trending };
  }
}
