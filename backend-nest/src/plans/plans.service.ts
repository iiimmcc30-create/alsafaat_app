import { Injectable, OnModuleInit } from '@nestjs/common';
import { PlanAudience } from '@prisma/client';
import { PlanPermissionService } from './plan-permission.service';
import { PlanResolverService } from './plan-resolver.service';
import { PlansRepository } from './repositories/plans.repository';
import type { PlanApiResponse } from './plan.types';

@Injectable()
export class PlansService implements OnModuleInit {
  constructor(
    private readonly repo: PlansRepository,
    private readonly resolver: PlanResolverService,
    private readonly permissions: PlanPermissionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.resolver.refreshCache();
  }

  async getPlans(audience?: PlanAudience): Promise<{ plans: PlanApiResponse[] }> {
    await this.resolver.refreshCache();
    const plans = audience
      ? this.resolver.getActiveByAudience(audience)
      : this.resolver.getAllActive();
    return { plans: plans.map((p) => this.resolver.toApiResponse(p)) };
  }

  async getPlansForAdmin() {
    return this.repo.findAll(true);
  }

  async getPlanById(id: string) {
    return this.repo.findById(id);
  }

  async createPlan(data: {
    slug: string;
    name: string;
    description?: string;
    audience: PlanAudience;
    monthlyPrice: number;
    yearlyPrice: number;
    currency?: string;
    yearlyDiscount?: number;
    isActive?: boolean;
    sortOrder?: number;
    features?: Array<{
      key: string;
      value: string;
      valueType: 'BOOLEAN' | 'NUMBER' | 'STRING' | 'JSON';
    }>;
  }) {
    const plan = await this.repo.create({
      slug: data.slug,
      name: data.name,
      description: data.description ?? '',
      audience: data.audience,
      monthlyPrice: data.monthlyPrice,
      yearlyPrice: data.yearlyPrice,
      currency: data.currency ?? 'SAR',
      yearlyDiscount: data.yearlyDiscount ?? 0,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      features: data.features?.length
        ? {
            create: data.features.map((f) => ({
              key: f.key,
              value: f.value,
              valueType: f.valueType,
            })),
          }
        : undefined,
    });
    await this.resolver.refreshCache();
    return plan;
  }

  async updatePlan(
    id: string,
    data: {
      name?: string;
      description?: string;
      audience?: PlanAudience;
      monthlyPrice?: number;
      yearlyPrice?: number;
      currency?: string;
      yearlyDiscount?: number;
      isActive?: boolean;
      sortOrder?: number;
      features?: Array<{
        key: string;
        value: string;
        valueType: 'BOOLEAN' | 'NUMBER' | 'STRING' | 'JSON';
      }>;
    },
  ) {
    const { features, ...planData } = data;
    await this.repo.update(id, planData);
    if (features) {
      await this.repo.replaceFeatures(id, features);
    }
    await this.resolver.refreshCache();
    return this.repo.findById(id);
  }

  async deactivatePlan(id: string) {
    const result = await this.repo.update(id, { isActive: false });
    await this.resolver.refreshCache();
    return result;
  }

  async duplicatePlan(id: string) {
    const source = await this.repo.findById(id);
    if (!source) return null;

    const copy = await this.repo.create({
      slug: `${source.slug}-copy-${Date.now().toString(36)}`,
      name: `${source.name} (Copy)`,
      description: source.description,
      audience: source.audience,
      monthlyPrice: source.monthlyPrice,
      yearlyPrice: source.yearlyPrice,
      currency: source.currency,
      yearlyDiscount: source.yearlyDiscount,
      isActive: false,
      sortOrder: source.sortOrder + 1,
      features: {
        create: source.features.map((f: { key: string; value: string; valueType: 'BOOLEAN' | 'NUMBER' | 'STRING' | 'JSON' }) => ({
          key: f.key,
          value: f.value,
          valueType: f.valueType,
        })),
      },
    });
    await this.resolver.refreshCache();
    return copy;
  }

  async deletePlanIfUnused(id: string) {
    const count = await this.repo.countSubscriptions(id);
    if (count > 0) {
      throw new Error('Plan is in use by active subscriptions');
    }
    await this.repo.delete(id);
    await this.resolver.refreshCache();
    return { deleted: true };
  }

  getUpgradablePlans(audience: PlanAudience) {
    return this.resolver.getUpgradableSlugs(audience);
  }

  getPlanPrice(slug: string, audience: PlanAudience, cycle: 'monthly' | 'yearly') {
    return this.resolver.getPlanPrice(slug, audience, cycle);
  }
}
