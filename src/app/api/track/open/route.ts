import { NextRequest, NextResponse } from 'next/server';
import { getBatchById, saveBatch, recordTrackingEvent } from '@/lib/storage';

// 1x1 transparent GIF binary buffer
const PIXEL_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const TRACKING_HEADERS: Record<string, string> = {
  'Content-Type': 'image/gif',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
};

function isAutomatedSecurityScanner(req: NextRequest): boolean {
  const userAgent = (req.headers.get('user-agent') || '').toLowerCase();

  // Allow Google Image Proxy (used by Gmail to display images)
  if (userAgent.includes('googleimageproxy') || userAgent.includes('ggpht')) {
    return false;
  }

  // Filter out anti-spam email scanners and automated CLI tools that scan before delivery
  const scannerKeywords = [
    'mimecast',
    'barracuda',
    'proofpoint',
    'fireeye',
    'curl',
    'wget',
    'python-requests',
    'postman',
    'pingdom',
    'uptimerobot',
  ];

  return scannerKeywords.some((kw) => userAgent.includes(kw));
}

/** Handle CORS preflight for cross-origin tracking pixel loads */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: TRACKING_HEADERS,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const recipientId = searchParams.get('recipientId');

    const userAgent = req.headers.get('user-agent') || '';
    const isScanner = isAutomatedSecurityScanner(req);

    if (batchId && recipientId && !isScanner) {
      const now = new Date().toISOString();

      // 1. Record persistent tracking event
      recordTrackingEvent({
        batchId,
        recipientId,
        eventType: 'OPEN',
        timestamp: now,
        userAgent,
      });

      // 2. Update batch on disk if available
      const batch = getBatchById(batchId);
      if (batch) {
        const recipient = batch.recipients.find((r) => r.id === recipientId);
        if (recipient) {
          if (recipient.sendStatus !== 'SEEN') {
            recipient.sendStatus = 'SEEN';
            recipient.seenAt = recipient.seenAt || now;
            recipient.deliveredAt = recipient.deliveredAt || now;

            // Recalculate stats
            batch.stats.seen = batch.recipients.filter((r) => r.sendStatus === 'SEEN').length;
            batch.stats.delivered = batch.recipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length;
            saveBatch(batch);
          }
        }
      }
    }
  } catch (err) {
    console.error('Tracking pixel error:', err);
  }

  return new NextResponse(new Uint8Array(PIXEL_BUFFER), {
    status: 200,
    headers: {
      ...TRACKING_HEADERS,
      'Content-Length': String(PIXEL_BUFFER.length),
    },
  });
}
