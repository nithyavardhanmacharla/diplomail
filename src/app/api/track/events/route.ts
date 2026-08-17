import { NextRequest, NextResponse } from 'next/server';
import { getTrackingEvents, TrackingEvent } from '@/lib/storage';

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

export async function POST(req: NextRequest) {
  try {
    const { batchId, apiKey, recipients } = await req.json();

    if (!batchId) {
      return NextResponse.json({ success: true, events: [] });
    }

    const localEvents: TrackingEvent[] = getTrackingEvents(batchId);
    const eventsMap = new Map<string, TrackingEvent>();

    localEvents.forEach((ev) => {
      eventsMap.set(`${ev.recipientId}_${ev.eventType}`, ev);
    });

    // If Resend API Key is provided and recipients have providerMessageIds, sync live status from Resend
    if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('re_') && Array.isArray(recipients)) {
      const candidates = recipients.filter((r: { providerMessageId?: string }) => Boolean(r.providerMessageId)).slice(0, 15);

      await Promise.all(
        candidates.map(async (r: { id: string; providerMessageId: string }) => {
          try {
            const res = await fetch(`https://api.resend.com/emails/${r.providerMessageId}`, {
              headers: { Authorization: `Bearer ${apiKey.trim()}` },
            });
            if (res.ok) {
              const data = await res.json();
              const lastEvent = (data.last_event || '').toLowerCase();
              const now = new Date().toISOString();

              if (lastEvent === 'opened' || lastEvent === 'clicked') {
                eventsMap.set(`${r.id}_OPEN`, {
                  batchId,
                  recipientId: r.id,
                  eventType: 'OPEN',
                  timestamp: data.created_at || now,
                });
              } else if (lastEvent === 'delivered') {
                eventsMap.set(`${r.id}_DELIVERED`, {
                  batchId,
                  recipientId: r.id,
                  eventType: 'DELIVERED',
                  timestamp: data.created_at || now,
                });
              }
            }
          } catch (e) {
            console.warn('Resend status sync error for message:', r.providerMessageId, e);
          }
        })
      );
    }

    const allEvents = Array.from(eventsMap.values());
    return NextResponse.json({ success: true, events: allEvents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to synchronize tracking events';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
