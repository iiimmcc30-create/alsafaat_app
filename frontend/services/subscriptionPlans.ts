// Powered by OnSpace.AI
// SAFAT Subscription Plans — Powered by Network International Payment Gateway

export type PlanId = 'free' | 'starter' | 'pro' | 'vip';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanFeature {
  text: string;
  arabic: string;
  included: boolean;
  highlight?: boolean;
}

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  arabicName: string;
  price: number;          // SAR per month
  yearlyPrice: number;    // SAR per year (discounted)
  currency: 'SAR';
  color: string;          // gradient start
  colorEnd: string;       // gradient end
  badge?: string;         // e.g. "الأشهر"
  description: string;
  arabicDescription: string;
  features: PlanFeature[];
  listingsPerMonth: number;
  featuredListings: number;
  pinnedListings: number;
  liveMinutesPerWeek: number; // 0 = none
  maxImages: number;
  verified: boolean;
  prioritySearch: boolean;
  advancedAnalytics: boolean;
  dedicatedSupport: boolean;
}

export const plans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    arabicName: 'مجاني',
    price: 0,
    yearlyPrice: 0,
    currency: 'SAR',
    color: '#334155',
    colorEnd: '#1E293B',
    description: 'Start trading on SAFAT',
    arabicDescription: 'ابدأ التداول في الصفاة',
    listingsPerMonth: 5,
    featuredListings: 0,
    pinnedListings: 0,
    liveMinutesPerWeek: 0,
    maxImages: 3,
    verified: false,
    prioritySearch: false,
    advancedAnalytics: false,
    dedicatedSupport: false,
    features: [
      { text: '5 listings per month', arabic: '٥ إعلانات شهريًا', included: true },
      { text: 'Up to 3 photos per listing', arabic: '٣ صور لكل إعلان', included: true },
      { text: 'Standard market visibility', arabic: 'ظهور عادي في السوق', included: true },
      { text: 'Featured listings', arabic: 'إعلانات مميزة', included: false },
      { text: 'Live streaming', arabic: 'بث مباشر', included: false },
      { text: 'Priority search', arabic: 'أولوية البحث', included: false },
      { text: 'Verified badge', arabic: 'شارة التوثيق', included: false },
    ],
  },

  {
    id: 'starter',
    name: 'Starter',
    arabicName: 'أساسي',
    price: 59,
    yearlyPrice: 590, // ~2 months free
    currency: 'SAR',
    color: '#1E3A8A',
    colorEnd: '#3B82F6',
    description: 'For active individual sellers',
    arabicDescription: 'للبائعين الأفراد النشطين',
    listingsPerMonth: 15,
    featuredListings: 1,
    pinnedListings: 0,
    liveMinutesPerWeek: 60,
    maxImages: 8,
    verified: false,
    prioritySearch: true,
    advancedAnalytics: false,
    dedicatedSupport: false,
    features: [
      { text: '15 listings per month', arabic: '١٥ إعلانًا شهريًا', included: true },
      { text: 'Up to 8 photos per listing', arabic: '٨ صور لكل إعلان', included: true },
      { text: 'Better search visibility', arabic: 'ظهور أفضل في البحث', included: true },
      { text: '1 featured listing per week', arabic: 'إعلان مميز أسبوعيًا', included: true, highlight: true },
      { text: 'Live stream 60 min/week', arabic: 'بث مباشر ٦٠ دقيقة أسبوعيًا', included: true, highlight: true },
      { text: 'Basic support', arabic: 'دعم فني بسيط', included: true },
      { text: 'Verified badge', arabic: 'شارة التوثيق', included: false },
      { text: 'Advanced analytics', arabic: 'تحليلات متقدمة', included: false },
    ],
  },

  {
    id: 'pro',
    name: 'Pro',
    arabicName: 'احترافي',
    price: 149,
    yearlyPrice: 1490,
    currency: 'SAR',
    color: '#7C3AED',
    colorEnd: '#A855F7',
    badge: 'الأشهر',
    description: 'For serious traders & breeders',
    arabicDescription: 'للمتداولين الجادين والمربين',
    listingsPerMonth: 30,
    featuredListings: 3,
    pinnedListings: 1,
    liveMinutesPerWeek: 120,
    maxImages: 15,
    verified: false,
    prioritySearch: true,
    advancedAnalytics: true,
    dedicatedSupport: false,
    features: [
      { text: '30 listings per month', arabic: '٣٠ إعلانًا شهريًا', included: true },
      { text: 'Up to 15 photos per listing', arabic: '١٥ صورة لكل إعلان', included: true },
      { text: '3 featured listings (Featured)', arabic: '٣ إعلانات مميزة', included: true, highlight: true },
      { text: '1 pinned listing', arabic: 'تثبيت إعلان واحد', included: true, highlight: true },
      { text: 'Live stream 120 min/week', arabic: 'بث مباشر ١٢٠ دقيقة أسبوعيًا', included: true, highlight: true },
      { text: 'Priority search placement', arabic: 'أولوية الظهور في البحث', included: true },
      { text: 'Advanced analytics', arabic: 'تحليلات متقدمة', included: true },
      { text: 'Verified badge', arabic: 'شارة التوثيق', included: false },
    ],
  },

  {
    id: 'vip',
    name: 'VIP',
    arabicName: 'VIP',
    price: 299,
    yearlyPrice: 2990,
    currency: 'SAR',
    color: '#B45309',
    colorEnd: '#F5C56A',
    badge: 'للشركات',
    description: 'For companies & major traders',
    arabicDescription: 'للشركات والتجار الكبار',
    listingsPerMonth: 999,
    featuredListings: 999,
    pinnedListings: 5,
    liveMinutesPerWeek: 999,
    maxImages: 30,
    verified: true,
    prioritySearch: true,
    advancedAnalytics: true,
    dedicatedSupport: true,
    features: [
      { text: 'Unlimited listings', arabic: 'إعلانات غير محدودة', included: true, highlight: true },
      { text: 'Unlimited photos', arabic: 'صور غير محدودة', included: true },
      { text: 'All listings pinned & featured', arabic: 'تثبيت وتمييز جميع الإعلانات', included: true, highlight: true },
      { text: 'Verified account badge', arabic: 'حساب موثق رسميًا', included: true, highlight: true },
      { text: 'Custom profile & branding', arabic: 'بروفايل خاص وهوية تجارية', included: true, highlight: true },
      { text: 'Unlimited live streaming + tools', arabic: 'بث مباشر غير محدود + أدوات تسويق', included: true, highlight: true },
      { text: 'Dedicated account manager', arabic: 'مدير حساب مخصص', included: true },
      { text: 'All Pro features included', arabic: 'جميع مميزات الباقات الأخرى', included: true },
    ],
  },
];

export function getPlanById(id: PlanId): SubscriptionPlan {
  return plans.find((p) => p.id === id) ?? plans[0];
}

export function getPlanColor(id: PlanId): [string, string] {
  const p = getPlanById(id);
  return [p.color, p.colorEnd];
}

export const PLAN_ICONS: Record<PlanId, string> = {
  free: '🔓',
  starter: '🔵',
  pro: '💜',
  vip: '👑',
};
