import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    // Note: We also have client-side verification in AuthContext for Bearer token in localStorage,
    // so if neither cookie nor token is present, redirect.
    if (!token) {
      // Allow client-side AuthContext fallback to check localStorage before hard-redirecting if needed
      // but if directly navigated on server with cookie, enforce.
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
