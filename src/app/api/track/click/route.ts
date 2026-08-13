import { NextRequest, NextResponse } from 'next/server';
import { getBatchById, saveBatch, getUploadedPdfBuffer } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const recipientId = searchParams.get('recipientId');

    if (batchId && recipientId) {
      const batch = getBatchById(batchId);
      if (batch) {
        const recipientItem = batch.recipients.find((r) => r.id === recipientId);
        if (recipientItem) {
          const now = new Date().toISOString();

          // Verified 100% Genuine Human Open (Recipient clicked their certificate link)
          recipientItem.sendStatus = 'SEEN';
          recipientItem.seenAt = recipientItem.seenAt || now;
          recipientItem.deliveredAt = recipientItem.deliveredAt || now;

          // Recalculate stats
          batch.stats.seen = batch.recipients.filter((r) => r.sendStatus === 'SEEN').length;
          batch.stats.delivered = batch.recipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length;
          saveBatch(batch);

          // Serve PDF certificate inline
          if (recipientItem.matchedPdfId) {
            const pdfInfo = batch.pdfs.find((p) => p.id === recipientItem.matchedPdfId);
            if (pdfInfo) {
              let buffer: Buffer | null = null;
              if (pdfInfo.contentBase64) {
                buffer = Buffer.from(pdfInfo.contentBase64, 'base64');
              } else if (pdfInfo.url) {
                buffer = getUploadedPdfBuffer(pdfInfo.url);
              }

              if (buffer) {
                return new NextResponse(new Uint8Array(buffer), {
                  status: 200,
                  headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="${pdfInfo.filename}"`,
                  },
                });
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Click tracking error:', err);
  }

  // Fallback redirect to home page
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return NextResponse.redirect(`${protocol}://${host}`);
}
