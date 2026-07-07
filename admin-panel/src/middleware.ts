import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawToken = request.cookies.get('admin_token')?.value;
  const token = rawToken ? decodeURIComponent(rawToken) : undefined;
  const isLogin = pathname.startsWith('/login');

  if (!token && !isLogin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (token && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
