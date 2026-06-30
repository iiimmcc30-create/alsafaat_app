// Custom entry — patches dev-runtime issues before expo-router loads.
if (__DEV__) {
  const { LogBox } = require('react-native');

  LogBox.ignoreLogs([
    'source.uri should not be an empty string',
  ]);

  try {
    const keepAwake = require('expo-keep-awake');
    if (keepAwake?.activateKeepAwakeAsync && !keepAwake.activateKeepAwakeAsync.__safatPatched) {
      const original = keepAwake.activateKeepAwakeAsync.bind(keepAwake);
      keepAwake.activateKeepAwakeAsync = async (tag) => {
        try {
          await original(tag);
        } catch {
          // Expo dev client may call keep-awake before Android Activity is ready.
        }
      };
      keepAwake.activateKeepAwakeAsync.__safatPatched = true;
    }
  } catch {}

  const prev = globalThis.onunhandledrejection;
  globalThis.onunhandledrejection = (event) => {
    const msg = event?.reason?.message ?? String(event?.reason ?? '');
    if (msg.includes('Unable to activate keep awake')) {
      event.preventDefault?.();
      return;
    }
    prev?.(event);
  };
}

require('expo-router/entry');
