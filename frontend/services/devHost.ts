import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getExpoDevHost(): string | null {
  if (!__DEV__) return null;

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return hostUri.replace(/^exp:\/\//, '').split(':')[0] ?? null;
  }

  const debuggerHost =
    (Constants.expoGoConfig as { debuggerHost?: string } | null)?.debuggerHost
    ?? (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;

  return debuggerHost?.split(':')[0] ?? null;
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1';
}

export function resolveDevServiceUrl(envUrl: string | undefined, port: number): string {
  const fromEnv = envUrl?.replace(/\/$/, '');
  const expoHost = getExpoDevHost();

  // Physical device: respect .env first (USB 127.0.0.1 or fixed LAN IP).
  if (__DEV__ && Constants.isDevice && fromEnv) {
    return fromEnv;
  }

  // USB + expo --localhost: PC reachable at 127.0.0.1 via adb reverse.
  if (Constants.isDevice && expoHost && isLoopbackHost(expoHost)) {
    return `http://127.0.0.1:${port}`;
  }

  // Wi‑Fi: same host Metro already uses.
  if (Constants.isDevice && expoHost && !isLoopbackHost(expoHost)) {
    return `http://${expoHost}:${port}`;
  }

  if (fromEnv) return fromEnv;

  if (Platform.OS === 'android' && !Constants.isDevice) {
    return `http://10.0.2.2:${port}`;
  }

  return `http://localhost:${port}`;
}
