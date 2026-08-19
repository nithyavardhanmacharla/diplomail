import { NextRequest, NextResponse } from 'next/server';
import { getTrackingEvents, recordTrackingEvent, TrackingEvent } from '@/lib/storage';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

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
      const candidates = recipients.filter((r: { providerMessageId?: string }) => Boolean(r.providerMessageId)).slice(0, 50);

      await Promise.all(
        candidates.map(async (r: { id: string; providerMessageId: string }) => {
          try {
            const res = await fetch(`https://api.resend.com/emails/${r.providerMessageId}`, {
              headers: { Authorization: `Bearer ${apiKey.trim()}` },
            });
            if (res.ok) {
              const data = await res.json();
              // Resend returns last_event as "email.opened", "email.delivered", "email.clicked" etc.
              // Normalize by stripping the "email." prefix and lowercasing
              const rawEvent = (data.last_event || '').toLowerCase();
              const lastEvent = rawEvent.replace('email.', '');

              console.log(`[Resend Sync] recipient=${r.id} msgId=${r.providerMessageId} last_event="${rawEvent}" normalized="${lastEvent}"`);

              if (lastEvent === 'opened' || lastEvent === 'clicked') {
                const openEvent: TrackingEvent = {
                  batchId,
                  recipientId: r.id,
                  eventType: 'OPEN',
                  timestamp: data.created_at || new Date().toISOString(),
                };
                eventsMap.set(`${r.id}_OPEN`, openEvent);
                // Persist so it survives across serverless invocations
                recordTrackingEvent(openEvent);
              } else if (lastEvent === 'delivered') {
                const deliveredEvent: TrackingEvent = {
                  batchId,
                  recipientId: r.id,
                  eventType: 'DELIVERED',
                  timestamp: data.created_at || new Date().toISOString(),
                };
                eventsMap.set(`${r.id}_DELIVERED`, deliveredEvent);
                recordTrackingEvent(deliveredEvent);
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
