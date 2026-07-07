/**
 * Wi‑Fi dev: start Metro + generate QR for the installed سرح dev app.
 * Usage: npm run start:qr
 */
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { networkInterfaces } = require('os');

const API_PORT = 3001;
const SOCKET_PORT = 3002;
const EXPO_PORT = process.env.EXPO_PORT || '8081';
const APP_SCHEME = 'safat';
const ROOT = path.join(__dirname, '..');
const QR_PATH = path.join(ROOT, 'expo-qr.png');

function getLanIp() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        if (
          entry.address.startsWith('192.168.') ||
          entry.address.startsWith('10.') ||
          entry.address.startsWith('172.')
        ) {
          return entry.address;
        }
      }
    }
  }
  return null;
}

function buildDevClientUrl(lanIp) {
  const metroUrl = `http://${lanIp}:${EXPO_PORT}`;
  return `exp+${APP_SCHEME}://expo-development-client/?url=${encodeURIComponent(metroUrl)}`;
}

function buildExpoGoUrl(lanIp) {
  return `exp://${lanIp}:${EXPO_PORT}`;
}

function downloadQr(data, outPath) {
  return new Promise((resolve, reject) => {
    const url =
      'https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=' +
      encodeURIComponent(data);
    const file = fs.createWriteStream(outPath);
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`QR download failed: ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(outPath)));
      })
      .on('error', reject);
  });
}

function openFile(filePath) {
  if (process.platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', filePath], () => {});
  } else if (process.platform === 'darwin') {
    execFile('open', [filePath], () => {});
  } else {
    execFile('xdg-open', [filePath], () => {});
  }
}

function killPort(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve();
      return;
    }
    execFile(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `$p = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess; if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }`,
      ],
      () => resolve(),
    );
  });
}

async function main() {
  const lanIp = getLanIp();
  if (!lanIp) {
    console.error('[start:qr] لم يُعثر على IP للشبكة المحلية. اتصل بالواي فاي.');
    process.exit(1);
  }

  const devClientUrl = buildDevClientUrl(lanIp);
  const expoGoUrl = buildExpoGoUrl(lanIp);
  const apiUrl = `http://${lanIp}:${API_PORT}`;
  const socketUrl = `http://${lanIp}:${SOCKET_PORT}`;

  await killPort(EXPO_PORT);

  try {
    await downloadQr(devClientUrl, QR_PATH);
    openFile(QR_PATH);
    console.log('[start:qr] تم إنشاء QR:', QR_PATH);
  } catch (err) {
    console.warn('[start:qr] تعذّر إنشاء صورة QR:', err instanceof Error ? err.message : err);
  }

  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('  سرح — تشغيل Metro للواي فاي');
  console.log('══════════════════════════════════════════');
  console.log('  IP:', lanIp);
  console.log('  Dev app (امسح QR):', devClientUrl);
  console.log('  Expo Go (بديل):', expoGoUrl);
  console.log('  API:', apiUrl);
  console.log('  DevTools:', `http://localhost:${EXPO_PORT}`);
  console.log('');
  console.log('  1) ثبّت التطبيق أولاً: npm run android');
  console.log('  2) نفس شبكة Wi‑Fi للهاتف والكمبيوتر');
  console.log('  3) امسح expo-qr.png من تطبيق سرح المثبّت');
  console.log('══════════════════════════════════════════');
  console.log('');

  const expo = spawn(
    'npx',
    ['expo', 'start', '--dev-client', '--lan', '--clear', '--port', EXPO_PORT],
    {
      stdio: 'inherit',
      shell: true,
      cwd: ROOT,
      env: {
        ...process.env,
        EXPO_PUBLIC_API_URL: apiUrl,
        EXPO_PUBLIC_SOCKET_URL: socketUrl,
        EXPO_NO_DOTENV: '1',
      },
    },
  );

  expo.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error('[start:qr]', err instanceof Error ? err.message : err);
  process.exit(1);
});
