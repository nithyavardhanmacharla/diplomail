import { NextRequest, NextResponse } from 'next/server';
import { verifyUserRole, validateGmailAddress, UserProfile } from '@/lib/auth';
import { extractClientIp, extractGeoLocation, logActivity, recordSession } from '@/lib/tracker';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, pin, sessionId } = body;

    // Strict Google Mail / Gmail Validation
    const validation = validateGmailAddress(email);
    if (!validation.valid || !validation.cleanEmail) {
      return NextResponse.json(
        { error: validation.error || 'Please enter a valid Google Mail address (@gmail.com).' },
        { status: 400 }
      );
    }

    const cleanEmail = validation.cleanEmail;
    const cleanName = (name || '').trim();
    const role = verifyUserRole(cleanEmail, pin);
    const now = new Date().toISOString();

    const user: UserProfile = {
      email: cleanEmail,
      name: cleanName || cleanEmail.split('@')[0],
      role,
      loginAt: now,
      provider: pin ? 'admin_pin' : 'email',
    };

    const ip = extractClientIp(req);
    const geo = extractGeoLocation(req, ip);
    const userAgent = req.headers.get('user-agent') || '';

    // Update connection session with authenticated user email
    if (sessionId) {
      recordSession({
        sessionId,
        ip,
        userAgent,
        headers: req.headers,
        userEmail: cleanEmail,
        userName: cleanName,
      });
    }

    // Log the authentication event
    logActivity({
      sessionId,
      userEmail: cleanEmail,
      userName: cleanName,
      ip,
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      category: 'AUTH',
      action: `User signed in: ${cleanEmail} (${role === 'admin' ? 'Administrator' : 'Standard User'})`,
      details: {
        email: cleanEmail,
        name: cleanName,
        role,
        adminVerified: role === 'admin',
      },
      status: 'SUCCESS',
    });

    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    console.error('Session login error:', err);
    const message = err instanceof Error ? err.message : 'Failed to authenticate user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
