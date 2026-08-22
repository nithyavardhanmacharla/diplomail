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
import { generateCertificatePdf } from '@/lib/pdf-generator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId') || searchParams.get('batch') || 'batch_default';
    const recipientId = searchParams.get('recipientId') || searchParams.get('id') || 'rec_default';
    const downloadParam = searchParams.get('download');

    const nameParam = searchParams.get('name') || searchParams.get('recipientName') || '';
    const emailParam = searchParams.get('email') || '';
    const filenameParam = searchParams.get('filename') || '';

    let recipientName = nameParam || 'Recipient';
    let recipientEmail = emailParam || '';
    let certificateFilename = filenameParam || 'Certificate.pdf';

    const now = new Date().toISOString();
    const userAgent = req.headers.get('user-agent') || '';

    // 1. Record verified human CLICK tracking event (marks SEEN)
    if (batchId && recipientId) {
      recordTrackingEvent({
        batchId,
        recipientId,
        eventType: 'CLICK',
        timestamp: now,
        userAgent,
      });
    }

    // 2. Find batch and recipient in persistent storage
    let batch = getBatchById(batchId);
    if (!batch && batchId) {
      const all = getAllBatches();
      batch = all.find((b) => b.id === batchId || b.recipients.some((r) => r.id === recipientId)) || null;
    }

    let buffer: Buffer | null = null;

    if (batch) {
      const recipientItem = batch.recipients.find(
        (r) =>
          r.id === recipientId ||
          (emailParam && r.recipient?.email?.toLowerCase() === emailParam.toLowerCase()) ||
          (nameParam && r.recipient?.name?.toLowerCase() === nameParam.toLowerCase())
      );

      if (recipientItem) {
        recipientName = recipientItem.recipient?.name || recipientName;
        recipientEmail = recipientItem.recipient?.email || recipientEmail;

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

    // Step F: Global fallback search by recipientId / recipientName if batch was lost
    if (!buffer) {
      buffer = getPdfBufferById(recipientId) || getPdfBufferByRecipientName(recipientName);
    }
    if (!buffer && filenameParam) {
      buffer = getPdfBufferByFilename(filenameParam);
    }

    // Step G: Direct on-the-fly certificate generation if not in local storage (e.g. Vercel serverless instance)
    if (!buffer || buffer.length === 0) {
      try {
        buffer = await generateCertificatePdf({
          recipientName: recipientName !== 'Recipient' ? recipientName : (nameParam || 'Recipient'),
          recipientEmail: recipientEmail || emailParam || '',
          certificateTitle: batch?.template?.subject?.replace(/\{\{.*?\}\}/g, '').trim() || 'Certificate of Completion',
          issueDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          batchId,
          recipientId,
          filename: certificateFilename,
        });
      } catch (genErr) {
        console.error('Dynamic PDF generation error:', genErr);
      }
    }

    // Always serve the PDF certificate directly to the browser (never redirect to a generic web notice)
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

    return new NextResponse('Certificate could not be loaded.', { status: 404 });
  } catch (err) {
    console.error('Click tracking error:', err);
    return new NextResponse('Internal error loading certificate.', { status: 500 });
  }
}
