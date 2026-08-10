import { NextRequest, NextResponse } from 'next/server';
import { getBatchById, saveBatch } from '@/lib/storage';

// 1x1 transparent GIF binary buffer
const PIXEL_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function isAutomatedSecurityScanner(req: NextRequest): boolean {
  const userAgent = (req.headers.get('user-agent') || '').toLowerCase();

  // Filter out anti-spam email scanners and automated CLI tools that scan before delivery
  const scannerKeywords = [
    'mimecast',
    'barracuda',
    'proofpoint',
    'fireeye',
    'checker',
    'curl',
    'wget',
    'python',
    'postman',
    'headless',
    'pingdom',
    'uptimerobot',
  ];

  if (scannerKeywords.some((kw) => userAgent.includes(kw))) {
    return true;
  }

  // Pre-fetch headers sent by automated crawlers
  const purpose = req.headers.get('purpose') || req.headers.get('x-purpose') || req.headers.get('sec-purpose') || '';
  if (purpose.toLowerCase().includes('prefetch')) {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const recipientId = searchParams.get('recipientId');

    // Only count as open if not an automated security scanner
    const isScanner = isAutomatedSecurityScanner(req);

    if (batchId && recipientId && !isScanner) {
      const batch = getBatchById(batchId);
      if (batch) {
        const recipient = batch.recipients.find((r) => r.id === recipientId);
        if (recipient) {
          const now = new Date().toISOString();

          // Idempotent state machine: SENT -> DELIVERED -> SEEN
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

  return new NextResponse(PIXEL_BUFFER, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL_BUFFER.length),
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
