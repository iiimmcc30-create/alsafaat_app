import { Country } from '@/services/types';

export const GCC_MAP_POSITION: Record<Country, { x: number; y: number }> = {
  SA: { x: 44, y: 48 },
  AE: { x: 52, y: 38 },
  KW: { x: 42, y: 32 },
  QA: { x: 50, y: 42 },
  BH: { x: 46, y: 40 },
  OM: { x: 56, y: 50 },
  EG: { x: 38, y: 28 },
};

export const COUNTRY_MAP_CENTER: Record<Country, { lat: number; lng: number; delta: number }> = {
  SA: { lat: 24.7136, lng: 46.6753, delta: 0.35 },
  AE: { lat: 25.2048, lng: 55.2708, delta: 0.35 },
  KW: { lat: 29.3759, lng: 47.9774, delta: 0.25 },
  QA: { lat: 25.2854, lng: 51.5310, delta: 0.25 },
  BH: { lat: 26.0667, lng: 50.5577, delta: 0.15 },
  OM: { lat: 23.5880, lng: 58.3829, delta: 0.45 },
  EG: { lat: 30.0444, lng: 31.2357, delta: 0.45 },
};

export function hasValidCoords(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}°N · ${lng.toFixed(5)}°E`;
}

/** Convert lat/lng to % position on the schematic GCC map */
export function coordsToMapPercent(lat: number, lng: number): { x: number; y: number } {
  const minLat = 12;
  const maxLat = 32;
  const minLng = 34;
  const maxLng = 60;
  const x = ((lng - minLng) / (maxLng - minLng)) * 80 + 10;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 80 + 10;
  return {
    x: Math.min(Math.max(x, 8), 92),
    y: Math.min(Math.max(y, 8), 92),
  };
}

export function getLocationPinPosition(
  country: Country,
  lat?: number | null,
  lng?: number | null,
  seed?: string,
): { x: number; y: number } {
  if (hasValidCoords(lat, lng)) {
    return coordsToMapPercent(lat!, lng!);
  }

  const countryPos = GCC_MAP_POSITION[country] ?? { x: 50, y: 50 };
  if (!seed) return countryPos;

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const jitterX = (hash % 10) - 5;
  const jitterY = ((hash >> 4) % 10) - 5;

  return {
    x: Math.min(Math.max(countryPos.x + jitterX, 10), 90),
    y: Math.min(Math.max(countryPos.y + jitterY, 10), 90),
  };
}
