import { NextRequest, NextResponse } from 'next/server';
import { verifyGoogleTokenWithApi, verifyUserRole, UserProfile } from '@/lib/auth';
import { extractClientIp, extractGeoLocation, logActivity, recordSession } from '@/lib/tracker';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { credential, sessionId } = body;

    if (!credential) {
      return NextResponse.json({ error: 'Google credential token is missing.' }, { status: 400 });
    }

    // Verify the Google ID Token
    const payload = await verifyGoogleTokenWithApi(credential);
    if (!payload || !payload.email) {
      return NextResponse.json(
        { error: 'Invalid Google credential token. Authentication failed.' },
        { status: 401 }
      );
    }

    const isVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!isVerified) {
      return NextResponse.json(
        { error: 'Your Google email address is not verified by Google.' },
        { status: 403 }
      );
    }

    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.name || cleanEmail.split('@')[0];
    const role = verifyUserRole(cleanEmail);
    const now = new Date().toISOString();

    const user: UserProfile = {
      email: cleanEmail,
      name: cleanName,
      picture: payload.picture,
      role,
      loginAt: now,
      provider: 'google',
    };

    const ip = extractClientIp(req);
    const geo = extractGeoLocation(req, ip);
    const userAgent = req.headers.get('user-agent') || '';

    // Link session with verified Google Identity
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

    // Log the authenticated Google sign-in event
    logActivity({
      sessionId,
      userEmail: cleanEmail,
      userName: cleanName,
      ip,
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      category: 'AUTH',
      action: `Google Sign-In verified: ${cleanEmail} (${role === 'admin' ? 'Administrator' : 'Standard User'})`,
      details: {
        email: cleanEmail,
        name: cleanName,
        picture: payload.picture,
        role,
        provider: 'google',
        verified: true,
      },
      status: 'SUCCESS',
    });

    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    console.error('Google Auth API error:', err);
    const message = err instanceof Error ? err.message : 'Failed to authenticate with Google.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
