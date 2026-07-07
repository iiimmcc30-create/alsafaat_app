import Constants from 'expo-constants';
import { resolveDevServiceUrl } from './devHost';

function resolveApiBase(): string {
  return resolveDevServiceUrl(process.env.EXPO_PUBLIC_API_URL, 3001);
}

const API_BASE = resolveApiBase();

if (__DEV__) {
  console.log('[سرح] API_BASE =', API_BASE);
  console.log('[سرح] Metro host =', Constants.expoConfig?.hostUri ?? 'n/a');
  if (API_BASE.includes('127.0.0.1')) {
    console.log('[سرح] USB — إذا فشل الاتصال: npm run adb:reverse (أو أعدي تشغيل Metro)');
  }
}

export { API_BASE };
