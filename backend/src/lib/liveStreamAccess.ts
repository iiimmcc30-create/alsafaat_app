// Subscription plan gating for live streaming (create + start)
import { getPlanById, PlanId } from './plans';

export type LiveStreamSubscription = {
  planId: string;
  liveMinutesUsed: number;
};

export type LiveStreamAccessDenied = {
  allowed: false;
  code: 'plan_required' | 'live_minutes_limit';
  messageAr: string;
  planId: PlanId;
};

export type LiveStreamAccessGranted = {
  allowed: true;
  planId: PlanId;
  liveMinutesLimit: number;
  liveMinutesUsed: number;
};

export type LiveStreamAccessResult = LiveStreamAccessDenied | LiveStreamAccessGranted;

export function checkLiveStreamAccess(
  sub: LiveStreamSubscription | null,
): LiveStreamAccessResult {
  const planId = (sub?.planId ?? 'free') as PlanId;
  const plan = getPlanById(planId);
  const liveMinutesUsed = sub?.liveMinutesUsed ?? 0;

  if (plan.liveMinutesPerWeek <= 0) {
    return {
      allowed: false,
      code: 'plan_required',
      messageAr: 'البث المباشر غير متاح في الباقة المجانية. قم بالترقية لبدء البث.',
      planId,
    };
  }

  if (plan.liveMinutesPerWeek < 999 && liveMinutesUsed >= plan.liveMinutesPerWeek) {
    return {
      allowed: false,
      code: 'live_minutes_limit',
      messageAr: `لقد استنفدت حصة البث الأسبوعية (${plan.liveMinutesPerWeek} دقيقة).`,
      planId,
    };
  }

  return {
    allowed: true,
    planId,
    liveMinutesLimit: plan.liveMinutesPerWeek,
    liveMinutesUsed,
  };
}
