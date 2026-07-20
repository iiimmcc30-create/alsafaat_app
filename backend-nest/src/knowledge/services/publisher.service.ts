import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/services/logger.service';
import { RedisCacheService } from '../../redis/services/redis-cache.service';
import { throwApi } from '../../common/exceptions/api.exception';
import { KnowledgeRepository } from '../repositories/knowledge.repository';

@Injectable()
export class PublisherService {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly cache: RedisCacheService,
    private readonly logger: LoggerService,
  ) {}

  buildPostBody(params: {
    titleAr: string;
    summary: string;
    sourceName: string;
    publishedAt?: Date | null;
  }): { content: string; arabicContent: string } {
    const when = params.publishedAt
      ? params.publishedAt.toISOString()
      : new Date().toISOString();
    const arabicContent = [
      params.titleAr,
      '',
      params.summary.trim(),
      '',
      `المصدر: ${params.sourceName}`,
      `وقت النشر: ${when}`,
      'وسم: خبر موثوق',
    ].join('\n');

    const content = [
      params.titleAr,
      '',
      params.summary.trim(),
      '',
      `Source: ${params.sourceName}`,
      `Published: ${when}`,
      'Tag: trusted-news',
    ].join('\n');

    return { content, arabicContent };
  }

  async publishArticle(articleId: string) {
    const article = await this.repo.findArticleById(articleId);
    if (!article) throwApi(404, 'not_found', 'الخبر غير موجود');
    if (article.status === 'REJECTED') {
      throwApi(400, 'rejected', 'لا يمكن نشر خبر مرفوض');
    }
    if (article.postId && article.status === 'PUBLISHED') {
      return article;
    }
    if (!article.summary || !article.titleAr) {
      throwApi(400, 'missing_summary', 'الخبر غير ملخّص بعد');
    }

    const author = await this.repo.findKnowledgeUser();
    if (!author) {
      throwApi(500, 'missing_author', 'حساب مركز المعرفة غير موجود');
    }

    const body = this.buildPostBody({
      titleAr: article.titleAr,
      summary: article.summary,
      sourceName: article.source.name,
      publishedAt: article.publishedAt,
    });

    const post = await this.repo.createPost({
      authorId: author.id,
      content: body.content,
      arabicContent: body.arabicContent,
    });

    const updated = await this.repo.updateArticle(articleId, {
      status: 'PUBLISHED',
      post: { connect: { id: post.id } },
      errorMessage: null,
    });

    await this.cache.del('posts:feed:first').catch(() => undefined);
    await this.cache.delPattern('posts:feed:*').catch(() => 0);
    await this.cache.delPattern('posts:feed:following:*').catch(() => 0);
    this.logger.info(
      { articleId, postId: post.id },
      'Knowledge article published as post',
    );
    return updated;
  }

  async rejectArticle(articleId: string, reason?: string) {
    const article = await this.repo.findArticleById(articleId);
    if (!article) throwApi(404, 'not_found', 'الخبر غير موجود');

    if (article.postId) {
      await this.repo.softHidePost(article.postId);
    }

    const updated = await this.repo.updateArticle(articleId, {
      status: 'REJECTED',
      errorMessage: reason?.trim() || 'Rejected by admin',
    });

    this.logger.info({ articleId }, 'Knowledge article rejected');
    return updated;
  }
}
