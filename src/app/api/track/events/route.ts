import { NextRequest, NextResponse } from 'next/server';
import { getTrackingEvents } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ success: true, events: [] });
    }

    const events = getTrackingEvents(batchId);
    return NextResponse.json({ success: true, events });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tracking events';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
