const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `npx expo run:android` starts Metro — set up adb reverse so 127.0.0.1 reaches the PC.
try {
  const { trySetupUsbReverse } = require('./scripts/start-usb.js');
  void trySetupUsbReverse().then((urls) => {
    if (urls) {
      console.log(`[safat] USB adb reverse OK — API ${urls.apiUrl}, socket ${urls.socketUrl}`);
    }
  });
} catch {
  // adb optional when no device is connected yet
}

module.exports = config;
