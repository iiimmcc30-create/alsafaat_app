import type { Listing } from '@/services/types';

/** Live livestock categories — وزن إلزامي (كجم) */
export const LIVESTOCK_CATEGORIES: Listing['category'][] = [
  'camels',
  'sheep',
  'goats',
  'cows',
  'horses',
];

export function isLivestockCategory(
  category?: Listing['category'] | string | null,
): boolean {
  return LIVESTOCK_CATEGORIES.includes(category as Listing['category']);
}
