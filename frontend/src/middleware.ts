import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const isLoginPath = request.nextUrl.pathname === '/login';

  if (!token && !isLoginPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isLoginPath && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/login'],
};
