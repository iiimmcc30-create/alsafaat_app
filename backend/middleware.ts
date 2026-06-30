import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function resolveAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes('*')) return origin;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;

  // Expo web dev server may use 8081, 8082, 8083, etc.
  if (process.env.NODE_ENV !== 'production') {
    const isLocalExpoWeb = /^http:\/\/localhost:\d+$/.test(origin);
    if (isLocalExpoWeb) return origin;
  }

  return null;
}

function applyCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Authorization,Content-Type,X-Requested-With,X-Request-ID',
  );
  response.headers.set('Vary', 'Origin');
  return response;
}

export function middleware(request: NextRequest) {
  const allowedOrigin = resolveAllowedOrigin(request);

  if (request.method === 'OPTIONS') {
    return applyCorsHeaders(new NextResponse(null, { status: 204 }), allowedOrigin);
  }

  return applyCorsHeaders(NextResponse.next(), allowedOrigin);
}

export const config = {
  matcher: '/api/:path*',
};
