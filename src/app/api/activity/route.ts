import { NextRequest, NextResponse } from 'next/server';
import {
  extractClientIp,
  extractGeoLocation,
  getAllActivityLogs,
  logActivity,
  ActivityCategory,
} from '@/lib/tracker';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let logs = getAllActivityLogs();
    if (category) {
      logs = logs.filter((l) => l.category === category);
    }

    return NextResponse.json({
      total: logs.length,
      events: logs.slice(0, limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch activity logs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, category, action, details, status } = body;

    if (!category || !action) {
      return NextResponse.json({ error: 'category and action are required' }, { status: 400 });
    }

    const ip = extractClientIp(req);
    const geo = extractGeoLocation(req, ip);

    const event = logActivity({
      sessionId,
      ip,
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      category: category as ActivityCategory,
      action,
      details,
      status: status || 'INFO',
    });

    return NextResponse.json({ success: true, event });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to log activity event';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
