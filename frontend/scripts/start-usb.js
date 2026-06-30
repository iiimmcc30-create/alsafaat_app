const { spawn, execFile } = require('child_process');
const path = require('path');
const net = require('net');
const { networkInterfaces } = require('os');

const API_PORT = 3001;
const SOCKET_PORT = 3002;
const EXPO_PORTS = [8081, 8082, 8083];
const EXPO_PORT = process.env.EXPO_PORT || '8081';
const ADB_TIMEOUT_MS = 20000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

const ADB =
  process.env.ANDROID_HOME
    ? path.join(process.env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
    : 'adb';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runAdb(args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    execFile(ADB, args, { timeout: ADB_TIMEOUT_MS }, (err, stdout, stderr) => {
      const out = `${stdout ?? ''}${stderr ?? ''}`.trim();
      if (err && !allowFailure) {
        reject(new Error(out || err.message));
        return;
      }
      resolve(out);
    }).on('error', (err) => {
      if (allowFailure) {
        resolve('');
        return;
      }
      reject(new Error(`adb not found (${ADB}): ${err.message}`));
    });
  });
}

function parseDevices(output) {
  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, state] = line.split(/\s+/);
      return { id, state };
    });
}

async function getDeviceState() {
  const output = await runAdb(['devices']);
  const devices = parseDevices(output);
  if (devices.length === 0) return { kind: 'none' };
  if (devices.some((d) => d.state === 'unauthorized')) return { kind: 'unauthorized' };
  if (devices.some((d) => d.state === 'offline')) return { kind: 'offline' };
  const ready = devices.find((d) => d.state === 'device');
  if (ready) return { kind: 'ready', id: ready.id };
  return { kind: 'unknown', devices };
}

function getLanIp() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal && entry.address.startsWith('192.168.')) {
        return entry.address;
      }
    }
  }
  return null;
}

function printUsbHelp(state) {
  if (state.kind === 'unauthorized') {
    console.error('[start:usb] الموبايل متصل لكن غير مصرّح.');
    console.error('[start:usb] افتح الموبايل ووافق على "Allow USB debugging" ثم أعد المحاولة.');
    return;
  }
  if (state.kind === 'offline') {
    console.error('[start:usb] الموبايل offline — افصل الكابل وأعد توصيله.');
    return;
  }
  console.error('[start:usb] لم يُعثر على موبايل متصل.');
  console.error('[start:usb] 1) وصّل الموبايل بالUSB');
  console.error('[start:usb] 2) فعّل USB debugging من Developer options');
  console.error('[start:usb] 3) وافق على رسالة التصريح على شاشة الموبايل');
}

function printLanFallback() {
  const lanIp = getLanIp();
  if (!lanIp) return;
  console.error(`[start:usb] بديل: شغّل بالواي فاي → npm run start:lan`);
  console.error(`[start:usb] وتأكد أن EXPO_PUBLIC_API_URL=http://${lanIp}:${API_PORT}`);
}

async function setupUsbReverse() {
  await runAdb(['start-server'], { allowFailure: true });

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const state = await getDeviceState();

    if (state.kind === 'ready') {
      await runAdb(['reverse', `tcp:${API_PORT}`, `tcp:${API_PORT}`]);
      await runAdb(['reverse', `tcp:${SOCKET_PORT}`, `tcp:${SOCKET_PORT}`]);
      for (const port of EXPO_PORTS) {
        await runAdb(['reverse', `tcp:${port}`, `tcp:${port}`], { allowFailure: true });
      }
      console.log(`[start:usb] adb reverse OK (${state.id}) — API :${API_PORT}, socket :${SOCKET_PORT}`);
      return {
        apiUrl: `http://127.0.0.1:${API_PORT}`,
        socketUrl: `http://127.0.0.1:${SOCKET_PORT}`,
      };
    }

    if (attempt < RETRY_ATTEMPTS) {
      console.warn(`[start:usb] محاولة ${attempt}/${RETRY_ATTEMPTS} — في انتظار الموبايل...`);
      await sleep(RETRY_DELAY_MS);
    } else {
      printUsbHelp(state);
      printLanFallback();
      throw new Error('no_ready_device');
    }
  }

  throw new Error('no_ready_device');
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function pickExpoPort() {
  const preferred = Number(process.env.EXPO_PORT) || EXPO_PORTS[0];
  const candidates = [preferred, ...EXPO_PORTS.filter((p) => p !== preferred)];
  for (const port of candidates) {
    if (await isPortFree(port)) return String(port);
  }
  return String(preferred);
}

async function main() {
  let urls;
  try {
    urls = await setupUsbReverse();
  } catch {
    process.exit(1);
  }

  const expoPort = await pickExpoPort();
  console.log('[start:usb] Starting Expo on port', expoPort);
  const expo = spawn(
    'npx',
    ['expo', 'start', '--localhost', '--clear', '--port', expoPort],
    {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        EXPO_PUBLIC_API_URL: urls.apiUrl,
        EXPO_PUBLIC_SOCKET_URL: urls.socketUrl,
      },
    },
  );

  expo.on('exit', (code) => process.exit(code ?? 0));
}

main();
