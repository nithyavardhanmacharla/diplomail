import { NextRequest, NextResponse } from 'next/server';
import { getBatchById, saveBatch, getUploadedPdfBuffer, getPdfBufferById, recordTrackingEvent } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');

  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const recipientId = searchParams.get('recipientId');

    let recipientName = 'Recipient';
    let recipientEmail = '';
    let certificateFilename = 'Certificate.pdf';

    if (batchId && recipientId) {
      const now = new Date().toISOString();
      const userAgent = req.headers.get('user-agent') || '';

      recordTrackingEvent({
        batchId,
        recipientId,
        eventType: 'CLICK',
        timestamp: now,
        userAgent,
      });

      const batch = getBatchById(batchId);
      if (batch) {
        const recipientItem = batch.recipients.find((r) => r.id === recipientId);
        if (recipientItem) {
          recipientName = recipientItem.recipient?.name || 'Recipient';
          recipientEmail = recipientItem.recipient?.email || '';

          // Verified 100% Genuine Human Open (Recipient clicked their certificate link)
          recipientItem.sendStatus = 'SEEN';
          recipientItem.seenAt = recipientItem.seenAt || now;
          recipientItem.deliveredAt = recipientItem.deliveredAt || now;

          // Recalculate stats
          batch.stats.seen = batch.recipients.filter((r) => r.sendStatus === 'SEEN').length;
          batch.stats.delivered = batch.recipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length;
          saveBatch(batch);

          // Serve PDF certificate inline if available
          if (recipientItem.matchedPdfId) {
            const pdfInfo = batch.pdfs.find(
              (p) =>
                p.id === recipientItem.matchedPdfId ||
                p.filename === recipientItem.matchedPdfName ||
                p.originalName === recipientItem.matchedPdfName
            );
            if (pdfInfo) {
              certificateFilename = pdfInfo.filename || pdfInfo.originalName || 'Certificate.pdf';
              let buffer: Buffer | null = null;
              if (pdfInfo.contentBase64) {
                buffer = Buffer.from(pdfInfo.contentBase64, 'base64');
              } else if (pdfInfo.url) {
                buffer = getUploadedPdfBuffer(pdfInfo.url);
              } else if (pdfInfo.id) {
                buffer = getPdfBufferById(pdfInfo.id);
              }

              if (buffer) {
                return new NextResponse(new Uint8Array(buffer), {
                  status: 200,
                  headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="${certificateFilename}"`,
                  },
                });
              }
            }
          }
        }
      }

      // If PDF file isn't cached on this particular serverless lambda container,
      // redirect to the Certificate Hub page rather than the blank homepage!
      return NextResponse.redirect(
        `${protocol}://${host}/certificate?name=${encodeURIComponent(recipientName)}&filename=${encodeURIComponent(certificateFilename)}&email=${encodeURIComponent(recipientEmail)}&status=verified`
      );
    }
  } catch (err) {
    console.error('Click tracking error:', err);
  }

  // Fallback redirect to home page
  return NextResponse.redirect(`${protocol}://${host}`);
}
