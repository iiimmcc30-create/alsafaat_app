import { resolveDevServiceUrl } from './devHost';

function resolveApiBase(): string {
  return resolveDevServiceUrl(process.env.EXPO_PUBLIC_API_URL, 3001);
}

const API_BASE = resolveApiBase();

export { API_BASE };
