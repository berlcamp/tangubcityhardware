import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function getTokenPayload(token: string): { role?: string } | null {
  try {
    const base64 = token.split('.')[1];
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const isLoginPath = request.nextUrl.pathname === '/login';
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');

  if (!token && !isLoginPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isLoginPath && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (isAdminPath && token) {
    const payload = getTokenPayload(token);
    if (payload?.role === 'CASHIER') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/login'],
};
