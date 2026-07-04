/**
 * USB debug build: adb reverse on all devices, then expo run:android.
 * Use android:dev (expo start only) for daily JS work — much faster.
 */
const { spawn } = require('child_process');
const path = require('path');

const useFullUsb = process.argv.includes('--full-usb');
const skipBundler = process.argv.includes('--no-bundler');

async function loadUsbSetup() {
  const mod = require('./start-usb.js');
  if (useFullUsb && typeof mod.setupUsbReverse === 'function') {
    return mod.setupUsbReverse();
  }
  if (typeof mod.setupUsbReverseQuick === 'function') {
    return mod.setupUsbReverseQuick();
  }
  if (typeof mod.setupUsbReverse === 'function') {
    return mod.setupUsbReverse();
  }
  throw new Error('USB setup helpers not found in start-usb.js');
}

async function main() {
  const usb = require('./start-usb.js');
  let urls;
  try {
    urls = await loadUsbSetup();
  } catch {
    process.exit(1);
  }

  await usb.cleanupStaleDevices();

  const deviceIds = urls.deviceIds ?? [];
  const details = await usb.getDeviceDetails();
  const ready = details.filter((d) => d.state === 'device');
  const serial =
    process.env.ANDROID_SERIAL ||
    deviceIds.find((id) => ready.some((d) => d.id === id)) ||
    ready[0]?.id;
  const primary = ready.find((d) => d.id === serial) ?? ready[0];

  console.log('[android:usb] API →', urls.apiUrl);
  console.log('[android:usb] Socket →', urls.socketUrl);
  if (deviceIds.length > 1) {
    console.log('[android:usb] أجهزة متصلة:', deviceIds.join(', '));
    console.log('[android:usb] التثبيت الأول على:', primary?.model ?? serial);
    console.log('[android:usb] بعد البناء: npm run android:install-all لتثبيت على الباقي');
  }
  console.log('[android:usb] تأكدي أن الباك إند شغال: cd backend && npm run dev:all');
  console.log(
    '[android:usb] نصيحة: للتعديلات اليومية استخدمي npm run android:dev (بدون rebuild)',
  );
  console.log('[android:usb] Gradle قد يستغرق 1-3 دقائق في أول مرة — البناء التالي أسرع');

  const expoArgs = ['expo', 'run:android'];
  if (skipBundler) {
    expoArgs.push('--no-bundler');
  }

  const child = spawn('npx', expoArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: urls.apiUrl,
      EXPO_PUBLIC_SOCKET_URL: urls.socketUrl,
      ANDROID_SERIAL: serial,
      SAFAT_USB_REVERSE_DONE: '1',
      ORG_GRADLE_PROJECT_reactNativeArchitectures: 'arm64-v8a',
    },
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}

main();
