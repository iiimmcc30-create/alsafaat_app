// src/lib/commissions.ts
// SAFAT — نظام العمولات الرسمي المعتمد
// ─────────────────────────────────────────────────────────────
// 🐑 أغنام وماعز   → 20 ريال / رأس
// 🐪 إبل            → 60 ريال / رأس
// 🐎🐄🦅🌾⚙️ باقي   → 2% من السعر
// 🥩 ملاحم          → عمولة على الطلب (يُحدَّد حسب الاتفاق)
// 🏪 متجر عادي      → 5% من السعر
// 🏪✅ متجر مشترك   → صفر عمولة (starter / pro / vip)
// ─────────────────────────────────────────────────────────────

export type ListingCat =
  | 'camels' | 'sheep' | 'goats' | 'cows' | 'horses'
  | 'birds'  | 'feed'  | 'equipment' | 'store';

export const PAID_PLANS = ['starter', 'pro', 'vip'] as const;
export type PaidPlan = typeof PAID_PLANS[number];

/** المتجر الموثّق بـ اشتراك مدفوع = صفر عمولة */
export function isStoreExempt(planId: string): boolean {
  return (PAID_PLANS as readonly string[]).includes(planId);
}

type RuleEntry =
  | { type: 'fixed';      value: number; unit: 'per_head'         }
  | { type: 'percent';    value: number; unit: 'percent_of_price' }
  | { type: 'by_plan';    value: number; unit: 'by_plan'          };

const RULES: Record<ListingCat, RuleEntry> = {
  sheep:     { type: 'fixed',      value: 20, unit: 'per_head'          },
  goats:     { type: 'fixed',      value: 20, unit: 'per_head'          },
  camels:    { type: 'fixed',      value: 60, unit: 'per_head'          },
  horses:    { type: 'percent',    value: 2,  unit: 'percent_of_price'  },
  cows:      { type: 'percent',    value: 2,  unit: 'percent_of_price'  },
  birds:     { type: 'percent',    value: 2,  unit: 'percent_of_price'  },
  feed:      { type: 'percent',    value: 2,  unit: 'percent_of_price'  },
  equipment: { type: 'percent',    value: 2,  unit: 'percent_of_price'  },
  store:     { type: 'by_plan',    value: 5,  unit: 'by_plan'           },
};

export interface CommissionResult {
  commission: number;
  isExempt: boolean;

  dueDate: Date;
  ruleDescription: string;
}

/**
 * @param category  فئة الإعلان
 * @param price     سعر البيع بالريال
 * @param quantity  عدد الرؤوس (للإبل/أغنام/ماعز)
 * @param planId    اشتراك البائع الحالي
 */
export function calculateCommission(
  category: ListingCat,
  price: number,
  quantity = 1,
  planId = 'free',
): CommissionResult {
  const rule = RULES[category] ?? RULES.equipment;


  const isExempt = category === 'store' && isStoreExempt(planId);

  let commission = 0;
  let ruleDescription = '';

  if (isExempt) {
    ruleDescription = 'صفر عمولة — متجر بـ اشتراك مدفوع';
  } else if (rule.type === 'fixed') {
    commission = rule.value * quantity;
    ruleDescription = `${rule.value} ريال × ${quantity} رأس = ${commission} ريال`;
  } else if (rule.type === 'percent' || rule.type === 'by_plan') {
    commission = Math.ceil((price * rule.value) / 100);
    ruleDescription = `${rule.value}% × ${price.toLocaleString('ar-SA')} ريال = ${commission} ريال`;
  }

  return {
    commission,
    isExempt,
  
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 أيام
    ruleDescription,
  };
}

/** للتحقق في الـ API قبل إنشاء listingFee في قاعدة البيانات */
export function shouldCreateFee(category: ListingCat, planId: string): boolean {
  if (category === 'store' && isStoreExempt(planId)) return false; // متجر/ملحمة بـ اشتراك — معفى
  return true;
}

/** Commission rules table for API / frontend display */
export const COMMISSION_TABLE = [
  { icon: '🐑', nameAr: 'الأغنام',              nameEn: 'Sheep',              ruleAr: '٢٠ ريال / رأس',     ruleEn: '20 SAR/head',    color: '#10B981' },
  { icon: '🐐', nameAr: 'الماعز',               nameEn: 'Goats',              ruleAr: '٢٠ ريال / رأس',     ruleEn: '20 SAR/head',    color: '#10B981' },
  { icon: '🐪', nameAr: 'الإبل',                nameEn: 'Camels',             ruleAr: '٦٠ ريال / رأس',     ruleEn: '60 SAR/head',    color: '#F5C56A' },
  { icon: '🐎', nameAr: 'الخيول',               nameEn: 'Horses',             ruleAr: '٢٪ من سعر الإعلان', ruleEn: '2% of price',    color: '#3B82F6' },
  { icon: '🐄', nameAr: 'الأبقار',              nameEn: 'Cattle',             ruleAr: '٢٪ من سعر الإعلان', ruleEn: '2% of price',    color: '#3B82F6' },
  { icon: '🦅', nameAr: 'الطيور والصقور',       nameEn: 'Birds & Falcons',    ruleAr: '٢٪ من سعر الإعلان', ruleEn: '2% of price',    color: '#3B82F6' },
  { icon: '🌾', nameAr: 'الأعلاف والمؤن',       nameEn: 'Feed & Fodder',      ruleAr: '٢٪ من سعر الإعلان', ruleEn: '2% of price',    color: '#3B82F6' },
  { icon: '⚙️', nameAr: 'المعدات والأدوات',     nameEn: 'Equipment & Tools',  ruleAr: '٢٪ من سعر الإعلان', ruleEn: '2% of price',    color: '#3B82F6' },
  { icon: '🏪', nameAr: 'متجر / ملحمة (بدون اشتراك)', nameEn: 'Store / Butcher (no sub)', ruleAr: '٥٪ من سعر البيع', ruleEn: '5% of sale', color: '#A855F7' },
  { icon: '✅', nameAr: 'متجر / ملحمة (بـ اشتراك)', nameEn: 'Store / Butcher (subscribed)', ruleAr: 'صفر عمولة', ruleEn: 'Zero commission', color: '#10B981' },
];
