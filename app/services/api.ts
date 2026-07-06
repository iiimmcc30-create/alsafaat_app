import Constants from 'expo-constants';
import { resolveDevServiceUrl } from './devHost';

function resolveApiBase(): string {
  return resolveDevServiceUrl(process.env.EXPO_PUBLIC_API_URL, 3001);
}

const API_BASE = resolveApiBase();

if (__DEV__) {
  console.log('[سروح] API_BASE =', API_BASE);
  console.log('[سروح] Metro host =', Constants.expoConfig?.hostUri ?? 'n/a');
}

export { API_BASE };
