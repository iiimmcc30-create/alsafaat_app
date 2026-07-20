export const LIVESTOCK_CATEGORIES = [
  'camels',
  'sheep',
  'goats',
  'cows',
  'horses',
] as const;

export type LivestockCategory = (typeof LIVESTOCK_CATEGORIES)[number];

export function isLivestockCategory(category: string): category is LivestockCategory {
  return (LIVESTOCK_CATEGORIES as readonly string[]).includes(category);
}
