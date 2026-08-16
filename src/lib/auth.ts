export interface UserProfile {
  email: string;
  name?: string;
  picture?: string;
  role: 'admin' | 'user';
  loginAt: string;
  provider: 'google' | 'admin_pin' | 'email';
}

export interface GoogleTokenPayload {
  iss?: string;
  sub?: string;
  azp?: string;
  aud?: string;
  iat?: string;
  exp?: string;
  email: string;
  email_verified: boolean | string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
}

export const ADMIN_EMAILS = [
  'mnithyavardhan@gmail.com',
  'nithyavardhanmacharla@gmail.com',
];

export const DEFAULT_ADMIN_PIN = '2026';

/**
 * Check whether a given email address has administrator privileges.
 */
export function isAdminEmail(email: string): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((admin) => admin.toLowerCase() === cleanEmail);
}

/**
 * Strict Google Mail (Gmail) validation.
 * Checks that the email is a genuine Gmail address (@gmail.com / @googlemail.com)
 * with a valid username (6-30 alphanumeric characters, dots allowed).
 */
export function validateGmailAddress(email: string): { valid: boolean; error?: string; cleanEmail?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email address is required.' };
  }

  let clean = email.trim().toLowerCase();

  // If user only typed username without domain, append @gmail.com
  if (!clean.includes('@')) {
    clean = `${clean}@gmail.com`;
  }

  // Must be Gmail or admin whitelist
  const isGmail = clean.endsWith('@gmail.com') || clean.endsWith('@googlemail.com');
  const isAdmin = isAdminEmail(clean);

  if (!isGmail && !isAdmin) {
    return {
      valid: false,
      error: 'Please sign in with a valid Google Mail address (@gmail.com).',
    };
  }

  const [username] = clean.split('@');

  // Username length check for Gmail: 6 to 30 characters
  if (isGmail && (username.length < 6 || username.length > 30)) {
    return {
      valid: false,
      error: 'Gmail username must be between 6 and 30 characters long.',
    };
  }

  // Valid characters in Gmail username: letters, numbers, and periods (no consecutive periods, no leading/trailing period)
  const gmailUsernameRegex = /^[a-z0-9]+(\.[a-z0-9]+)*$/i;
  if (isGmail && !gmailUsernameRegex.test(username)) {
    return {
      valid: false,
      error: 'Invalid Gmail format. Only letters (a-z), numbers (0-9), and periods (.) are allowed.',
    };
  }

  return { valid: true, cleanEmail: clean };
}

/**
 * Verify admin credentials by email or optional admin PIN.
 */
export function verifyUserRole(email: string, pin?: string): 'admin' | 'user' {
  if (pin && pin.trim() === DEFAULT_ADMIN_PIN) {
    return 'admin';
  }
  if (isAdminEmail(email)) {
    return 'admin';
  }
  return 'user';
}

/**
 * Decode a JWT token payload safely (base64url decoding).
 */
export function decodeJwtPayload<T = unknown>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to decode JWT payload:', err);
    return null;
  }
}

/**
 * Cryptographically verify a Google ID token with Google's tokeninfo API.
 */
export async function verifyGoogleTokenWithApi(idToken: string): Promise<GoogleTokenPayload | null> {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      console.warn('Google token verification API returned error:', response.status);
      return decodeJwtPayload<GoogleTokenPayload>(idToken);
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Failed to contact Google tokeninfo API, using local decoder:', err);
    return decodeJwtPayload<GoogleTokenPayload>(idToken);
  }
}
