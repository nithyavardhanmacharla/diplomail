import { NextResponse } from 'next/server';

/**
 * Security headers proxy.
 * Applies protective HTTP headers to all responses to mitigate common web vulnerabilities.
 *
 * In Next.js 16+, the "middleware" convention is renamed to "proxy".
 */
export function proxy() {
  const response = NextResponse.next();

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking — don't allow this app to be embedded in iframes
  response.headers.set('X-Frame-Options', 'DENY');

  // Legacy XSS filter (still respected by some browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Control referrer information leakage
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict access to browser features
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Prevent DNS prefetch to reduce privacy leaks
  response.headers.set('X-DNS-Prefetch-Control', 'off');

  return response;
}

export const config = {
  // Apply security headers to all routes except static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|icon.png|apple-icon.png).*)',
  ],
};
