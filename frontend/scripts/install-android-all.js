/**
 * Install debug APK on every connected authorized Android device.
 */
const { installApkOnAllDevices } = require('./start-usb.js');

installApkOnAllDevices()
  .then((ids) => {
    console.log(`[android:install-all] تم التثبيت على: ${ids.join(', ')}`);
  })
  .catch((err) => {
    console.error('[android:install-all]', err.message || err);
    process.exit(1);
  });
