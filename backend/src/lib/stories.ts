// Story constants — lifespan 24h, fixed slide duration in viewer

export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const STORY_SLIDE_DURATION_SEC = 5;

export function storyExpiresAt(from = Date.now()): Date {
  return new Date(from + STORY_LIFETIME_MS);
}

export function storyTimeLeftLabel(expiresAt: string | Date): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'منتهية';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours} س ${minutes} د متبقية`;
  return `${minutes} د متبقية`;
}
