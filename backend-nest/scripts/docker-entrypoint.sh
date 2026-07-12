#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "On Railway: Create → Database → PostgreSQL, then Variables → Add Reference:"
  echo "  DATABASE_URL = \${{Postgres.DATABASE_URL}}"
  exit 1
fi

echo "Checking database connectivity..."
if ! node <<'NODE'
const net = require('net');
const { URL } = require('url');
try {
  const u = new URL(process.env.DATABASE_URL);
  const host = u.hostname;
  const port = Number(u.port || 5432);
  const socket = net.connect({ host, port });
  const timer = setTimeout(() => {
    socket.destroy();
    console.error(`ERROR: Timed out connecting to ${host}:${port}`);
    console.error('PostgreSQL service is missing or DATABASE_URL is stale.');
    console.error('Create PostgreSQL in this Railway environment and set DATABASE_URL via Variable Reference.');
    process.exit(1);
  }, 5000);
  socket.on('connect', () => {
    clearTimeout(timer);
    socket.end();
    process.exit(0);
  });
  socket.on('error', (err) => {
    clearTimeout(timer);
    console.error(`ERROR: Cannot reach database ${host}:${port} (${err.message})`);
    console.error('There is no reachable PostgreSQL in this environment.');
    console.error('Fix: Railway project → Create → Database → PostgreSQL');
    console.error('Then on the API service Variables: delete old DATABASE_URL and Add Reference → Postgres → DATABASE_URL');
    process.exit(1);
  });
} catch (err) {
  console.error('ERROR: Invalid DATABASE_URL:', err.message);
  process.exit(1);
}
NODE
then
  exit 1
fi

echo "Running prisma migrate deploy..."
i=0
until npx prisma migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge 5 ]; then
    echo "ERROR: prisma migrate deploy failed after $i attempts."
    exit 1
  fi
  echo "Migrate not ready yet (attempt $i/5). Retrying in 3s..."
  sleep 3
done

echo "Starting NestJS API..."
exec node dist/main.js
