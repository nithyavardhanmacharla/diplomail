import { NextRequest, NextResponse } from 'next/server';
import {
  extractClientIp,
  extractGeoLocation,
  recordSession,
  getConnectionsSummary,
  clearAllLogs,
  logActivity,
} from '@/lib/tracker';

export async function GET() {
  try {
    const summary = getConnectionsSummary();
    return NextResponse.json(summary);
  } catch (err: unknown) {
    console.error('Failed to get connections summary:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, nickname, userEmail, userName, isInitialConnect } = body;

    const ip = extractClientIp(req);
    const userAgent = req.headers.get('user-agent') || '';
    const geo = extractGeoLocation(req, ip);

    const session = recordSession({
      sessionId,
      ip,
      userAgent,
      headers: req.headers,
      nickname,
      userEmail,
      userName,
    });

    if (isInitialConnect) {
      const userTag = userEmail ? ` [User: ${userEmail}]` : '';
      logActivity({
        sessionId: session.sessionId,
        userEmail,
        userName,
        ip,
        country: geo.country,
        countryCode: geo.countryCode,
        city: geo.city,
        category: 'PAGE_VIEW',
        action: `Connected to DiploMail${userTag} from ${geo.city}, ${geo.country} (${session.browser} on ${session.os})`,
        status: 'INFO',
      });
    }

    const summary = getConnectionsSummary();
    return NextResponse.json({ success: true, session, summary });
  } catch (err: unknown) {
    console.error('Failed to record connection heartbeat:', err);
    const message = err instanceof Error ? err.message : 'Failed to record connection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearAllLogs();
    logActivity({
      category: 'SYSTEM',
      action: 'Connection and activity logs were cleared by administrator',
      status: 'WARNING',
    });
    const summary = getConnectionsSummary();
    return NextResponse.json({ success: true, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to clear logs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
