import { NextRequest, NextResponse } from 'next/server';
import {
  getBatchById,
  getAllBatches,
  saveBatch,
  getUploadedPdfBuffer,
  getPdfBufferById,
  getPdfBufferByFilename,
  getPdfBufferByRecipientName,
  recordTrackingEvent,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');

  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const recipientId = searchParams.get('recipientId');
    const downloadParam = searchParams.get('download');

    let recipientName = 'Recipient';
    let recipientEmail = '';
    let certificateFilename = 'Certificate.pdf';

    if (batchId && recipientId) {
      const now = new Date().toISOString();
      const userAgent = req.headers.get('user-agent') || '';

      // 1. Record verified human CLICK tracking event
      recordTrackingEvent({
        batchId,
        recipientId,
        eventType: 'CLICK',
        timestamp: now,
        userAgent,
      });

      // 2. Find batch and recipient
      let batch = getBatchById(batchId);
      if (!batch) {
        // Fallback: search all batches if batchId lookup had any cold-start delay
        const all = getAllBatches();
        batch = all.find((b) => b.id === batchId || b.recipients.some((r) => r.id === recipientId)) || null;
      }

      let buffer: Buffer | null = null;

      if (batch) {
        const recipientItem = batch.recipients.find((r) => r.id === recipientId);
        if (recipientItem) {
          recipientName = recipientItem.recipient?.name || 'Recipient';
          recipientEmail = recipientItem.recipient?.email || '';

          // Verified 100% Genuine Human Open (Recipient clicked their certificate download link)
          recipientItem.sendStatus = 'SEEN';
          recipientItem.seenAt = recipientItem.seenAt || now;
          recipientItem.deliveredAt = recipientItem.deliveredAt || now;

          // Recalculate stats
          batch.stats.seen = batch.recipients.filter((r) => r.sendStatus === 'SEEN').length;
          batch.stats.delivered = batch.recipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length;
          saveBatch(batch);

          // Find PDF metadata
          const pdfInfo = batch.pdfs.find(
            (p) =>
              (recipientItem.matchedPdfId && p.id === recipientItem.matchedPdfId) ||
              p.filename === recipientItem.matchedPdfName ||
              p.originalName === recipientItem.matchedPdfName ||
              (recipientItem.matchedPdfName && p.filename?.toLowerCase() === recipientItem.matchedPdfName.toLowerCase()) ||
              (recipientItem.matchedPdfName && p.originalName?.toLowerCase() === recipientItem.matchedPdfName.toLowerCase())
          );

          certificateFilename =
            pdfInfo?.filename ||
            pdfInfo?.originalName ||
            recipientItem.matchedPdfName ||
            `${recipientName.replace(/\s+/g, '_')}_Certificate.pdf`;

          if (!certificateFilename.toLowerCase().endsWith('.pdf')) {
            certificateFilename += '.pdf';
          }

          // Step A: Check base64 in pdfInfo
          if (pdfInfo?.contentBase64) {
            try {
              buffer = Buffer.from(pdfInfo.contentBase64, 'base64');
            } catch (e) {
              console.warn('Failed to parse base64 PDF:', e);
            }
          }

          // Step B: Check stored URL path
          if (!buffer && pdfInfo?.url) {
            buffer = getUploadedPdfBuffer(pdfInfo.url);
          }

          // Step C: Check by matchedPdfId or pdfInfo.id
          if (!buffer && recipientItem.matchedPdfId) {
            buffer = getPdfBufferById(recipientItem.matchedPdfId);
          }
          if (!buffer && pdfInfo?.id) {
            buffer = getPdfBufferById(pdfInfo.id);
          }

          // Step D: Check by matchedPdfName / filename
          if (!buffer && recipientItem.matchedPdfName) {
            buffer = getPdfBufferByFilename(recipientItem.matchedPdfName);
          }
          if (!buffer && pdfInfo?.filename) {
            buffer = getPdfBufferByFilename(pdfInfo.filename);
          }
          if (!buffer && pdfInfo?.originalName) {
            buffer = getPdfBufferByFilename(pdfInfo.originalName);
          }

          // Step E: Check by recipient's full name
          if (!buffer && recipientName && recipientName !== 'Recipient') {
            buffer = getPdfBufferByRecipientName(recipientName);
          }
        }
      }

      // Step F: Global fallback by recipientId / recipientName if batch was lost
      if (!buffer) {
        buffer = getPdfBufferById(recipientId) || getPdfBufferByRecipientName(recipientName);
      }

      // If PDF buffer found, serve it directly to the browser (inline view or attachment download)
      if (buffer && buffer.length > 0) {
        const isForceDownload = downloadParam === 'true' || downloadParam === '1';
        const dispositionType = isForceDownload ? 'attachment' : 'inline';
        const cleanFilename = certificateFilename.replace(/[^a-zA-Z0-9_.-]/g, '_');

        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `${dispositionType}; filename="${cleanFilename}"`,
            'Content-Length': String(buffer.length),
            'Cache-Control': 'public, max-age=86400',
            'Accept-Ranges': 'bytes',
          },
        });
      }

      // If PDF file isn't cached on this particular serverless lambda container,
      // redirect to the Certificate Hub page with full verified status and email details
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
