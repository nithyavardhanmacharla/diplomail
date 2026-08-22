import { NextRequest, NextResponse } from 'next/server';
import { getBatchById, saveBatch, getUploadedPdfBuffer, getPdfBufferById, getPdfBufferByFilename, recordTrackingEvent } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * Inline HTML fallback when PDF buffer is unavailable on this server instance.
 * Never redirects — renders a self-contained page telling the user to check their email attachment.
 */
function buildFallbackHtml(name: string, filename: string, email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificate — ${name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;background:#090d16;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{max-width:480px;width:100%;background:rgba(15,23,42,.85);border:1px solid #1e293b;border-radius:16px;padding:40px 32px;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}
    .icon{width:64px;height:64px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px}
    h1{font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:8px}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:9999px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);color:#34d399;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px}
    .info{background:rgba(2,6,23,.6);border:1px solid rgba(30,41,59,.8);border-radius:12px;padding:16px;text-align:left;margin:20px 0;font-size:13px;color:#94a3b8}
    .info strong{color:#cbd5e1}
    .notice{background:rgba(79,70,229,.08);border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:16px;font-size:12px;color:#a5b4fc;text-align:left;line-height:1.6;margin-top:16px}
    .notice b{color:#e2e8f0}
    .footer{margin-top:24px;font-size:11px;color:#475569}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📜</div>
    <div class="badge">✓ Verified &amp; Tracked as Seen</div>
    <h1>Your Certificate is Ready</h1>
    <div class="info">
      <div style="display:flex;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid rgba(30,41,59,.6);margin-bottom:8px">
        <span>Recipient</span><strong>${name}</strong>
      </div>
      ${email ? `<div style="display:flex;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid rgba(30,41,59,.6);margin-bottom:8px"><span>Email</span><strong>${email}</strong></div>` : ''}
      <div style="display:flex;justify-content:space-between">
        <span>Document</span><strong>${filename}</strong>
      </div>
    </div>
    <div class="notice">
      <b>📎 Your certificate is attached to the email in your inbox.</b><br/>
      Please return to your email client (Gmail, Outlook, etc.) and open or download the PDF attachment named <b>${filename}</b>.
    </div>
    <p class="footer">DiploMail • Secure Certificate Dispatch</p>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
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

      // 1. Always record tracking event
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

          // 2. Mark as SEEN (verified human click)
          recipientItem.sendStatus = 'SEEN';
          recipientItem.seenAt = recipientItem.seenAt || now;
          recipientItem.deliveredAt = recipientItem.deliveredAt || now;

          // 3. Recalculate stats
          batch.stats.seen = batch.recipients.filter((r) => r.sendStatus === 'SEEN').length;
          batch.stats.delivered = batch.recipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length;
          saveBatch(batch);

          // 4. Serve PDF certificate directly if available on this server
          if (recipientItem.matchedPdfId || recipientItem.matchedPdfName) {
            const pdfInfo = batch.pdfs.find(
              (p) =>
                (recipientItem.matchedPdfId && p.id === recipientItem.matchedPdfId) ||
                p.filename === recipientItem.matchedPdfName ||
                p.originalName === recipientItem.matchedPdfName
            );

            certificateFilename = pdfInfo?.filename || pdfInfo?.originalName || recipientItem.matchedPdfName || 'Certificate.pdf';
            let buffer: Buffer | null = null;

            if (pdfInfo) {
              if (pdfInfo.contentBase64) {
                buffer = Buffer.from(pdfInfo.contentBase64, 'base64');
              } else if (pdfInfo.url) {
                buffer = getUploadedPdfBuffer(pdfInfo.url);
              } else if (pdfInfo.id) {
                buffer = getPdfBufferById(pdfInfo.id);
              }
            }

            if (!buffer && recipientItem.matchedPdfId) {
              buffer = getPdfBufferById(recipientItem.matchedPdfId);
            }

            if (!buffer && recipientItem.matchedPdfName) {
              buffer = getPdfBufferByFilename(recipientItem.matchedPdfName);
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

      // 5. PDF not available on this server — show inline message (NO REDIRECT)
      return new NextResponse(buildFallbackHtml(recipientName, certificateFilename, recipientEmail), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  } catch (err) {
    console.error('Click tracking error:', err);
  }

  // Fallback — no batchId/recipientId or error — show generic message (NO REDIRECT)
  return new NextResponse(buildFallbackHtml('Recipient', 'Certificate.pdf', ''), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

