import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisCacheService } from '../../redis/services/redis-cache.service';
import { QUEUE_NAMES } from '../constants';
import type { FeeCheckJob } from '../types/queue.types';

@Injectable()
export class FeeCheckQueueService {
  constructor(
    @Optional()
    @InjectQueue(QUEUE_NAMES.FEE_CHECKS)
    private readonly queue: Queue | null,
    private readonly cache: RedisCacheService,
  ) {}

  async scheduleFeeCheck(job: FeeCheckJob, delayMs: number) {
    if (!this.cache.isEnabled() || !this.queue) return null;
    return this.queue.add('check', job, {
      delay: Math.max(0, delayMs),
      attempts: 2,
      jobId: `fee:${job.listingFeeId}`,
    });
  }

  async addFeeCheck(job: FeeCheckJob) {
    if (!this.cache.isEnabled() || !this.queue) return null;
    return this.queue.add('check', job, {
      jobId: `fee:${job.listingFeeId}`,
      attempts: 3,
    });
  }
}
