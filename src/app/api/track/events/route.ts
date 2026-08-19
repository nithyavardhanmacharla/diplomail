import { NextRequest, NextResponse } from 'next/server';
import { getTrackingEvents, recordTrackingEvent, getSavedSmtpConfig, TrackingEvent } from '@/lib/storage';

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

    const effectiveApiKey = apiKey || process.env.RESEND_API_KEY || process.env.SMTP_PASS || getSavedSmtpConfig()?.pass;

    // If Resend API Key is available and recipients have providerMessageIds, sync live status from Resend
    if (effectiveApiKey && typeof effectiveApiKey === 'string' && (effectiveApiKey.startsWith('re_') || effectiveApiKey.includes('resend')) && Array.isArray(recipients)) {
      const candidates = recipients.filter((r: { providerMessageId?: string }) => Boolean(r.providerMessageId)).slice(0, 50);

      await Promise.all(
        candidates.map(async (r: { id: string; providerMessageId: string }) => {
          try {
            const res = await fetch(`https://api.resend.com/emails/${r.providerMessageId}`, {
              headers: { Authorization: `Bearer ${effectiveApiKey.trim()}` },
            });
            if (res.ok) {
              const data = await res.json();
              const rawEvent = (data.last_event || '').toLowerCase();

              console.log(`[Resend Sync] recipient=${r.id} msgId=${r.providerMessageId} last_event="${rawEvent}"`);

              if (rawEvent.includes('open') || rawEvent.includes('click')) {
                const openEvent: TrackingEvent = {
                  batchId,
                  recipientId: r.id,
                  eventType: 'OPEN',
                  timestamp: data.created_at || new Date().toISOString(),
                };
                eventsMap.set(`${r.id}_OPEN`, openEvent);
                // Persist so it survives across serverless invocations
                recordTrackingEvent(openEvent);
              } else if (rawEvent.includes('deliver')) {
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
