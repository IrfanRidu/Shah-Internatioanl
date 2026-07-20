import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Admin route protection
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login?callbackUrl=/admin', req.url));
    }
    if (!['superAdmin', 'admin', 'editor'].includes(token.role)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // Protected user routes
  const protectedRoutes = ['/checkout', '/orders', '/profile'];
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!token) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.url));
    }
  }

  // Prevent logged-in users from accessing login/register
  if (['/login', '/register'].includes(pathname) && token) {
    const redirectTo = token.role?.includes('Admin') || token.role === 'editor' ? '/admin' : '/';
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/checkout/:path*', '/orders/:path*', '/profile/:path*', '/login', '/register'],
};
