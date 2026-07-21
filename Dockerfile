# SARH backend — build from monorepo root for Railway/GitHub deploy.
# If your Railway service Root Directory is backend-nest, use backend-nest/Dockerfile instead.
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

COPY backend-nest/package.json backend-nest/package-lock.json ./
COPY backend-nest/prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY backend-nest/ .
RUN npm run build

FROM node:22-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

COPY backend-nest/package.json backend-nest/package-lock.json ./
COPY backend-nest/prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

ENV DATABASE_URL=""

COPY --from=builder /app/dist ./dist
COPY backend-nest/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001

CMD ["./docker-entrypoint.sh"]
