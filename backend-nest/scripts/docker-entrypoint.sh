#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Add a Railway PostgreSQL service and set DATABASE_URL=\${{Postgres.DATABASE_URL}} on this service."
  exit 1
fi

echo "Running prisma migrate deploy..."
npx prisma migrate deploy

echo "Starting NestJS API..."
exec node dist/main.js
