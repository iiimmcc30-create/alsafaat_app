// next.config.js
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output:       'standalone',
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'] },
  images: {
    domains: [
      'safat-uploads.s3.me-south-1.amazonaws.com',
      'cdn.safat.app',
      'res.cloudinary.com',
    ],
  },

  // API versioning: /api/v1/* maps to /api/* transparently.
  // All new routes should be created under /api/ (no v1 folder needed).
  // When a breaking change is needed, create /api/v2/* and keep /api/* for v1 compat.
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: '/api/:path*' },
    ];
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          // CORS origin is set dynamically in middleware.ts (supports multiple Expo web ports).
          // Security headers
          { key: 'X-Content-Type-Options',           value: 'nosniff' },
          { key: 'X-Frame-Options',                  value: 'DENY' },
          { key: 'X-XSS-Protection',                 value: '1; mode=block' },
          { key: 'Referrer-Policy',                  value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

// Sentry is only wired in when DSN is provided — no-op in dev without it
const sentryWebpackOptions = {
  silent:                true,
  org:                   process.env.SENTRY_ORG,
  project:               'safat-backend',
  widenClientFileUpload: true,
  hideSourceMaps:        true,
  disableLogger:         true,
  // Automatically instrument Next.js data fetching methods
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware:      true,
};

module.exports = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackOptions)
  : nextConfig;
