import nodemailer from 'nodemailer';
import { SmtpConfig, MatchedRecipient, EmailTemplate, BatchSession, PdfFileInfo } from './types';
import { interpolateTemplate } from './template';
import { getUploadedPdfBuffer, saveBatch, getBatchById } from './storage';

export function createTransporter(config: Partial<SmtpConfig>) {
  const host = config.host || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(config.port || process.env.SMTP_PORT || 465);
  // Port 465 requires secure: true (implicit SSL/TLS). Port 587 requires secure: false (STARTTLS).
  const secure = port === 465 ? true : Boolean(config.secure);
  const user = config.user || process.env.SMTP_USER || '';
  const pass = config.pass || process.env.SMTP_PASS || '';

  if (!user || !pass) {
    throw new Error('SMTP Username and Password are required. Please configure your sender email in SMTP settings.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      // Enforce TLS cert validation in production; allow self-signed in dev
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
    connectionTimeout: 15000, // 15s connection timeout
    greetingTimeout: 15000,   // 15s greeting timeout
    socketTimeout: 20000,     // 20s socket timeout
  });
}

function formatSmtpError(error: any, port: number): string {
  const msg = error?.message || String(error);
  if (msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED') || msg.includes('ESOCKET')) {
    if (port === 587) {
      return `Connection timed out on Port 587. Port 587 (TLS/STARTTLS) is blocked by many ISPs. Click 'Reconfigure SMTP' and select ⭐ Gmail (Port 465 SSL). (${msg})`;
    }
    return `Connection timed out on Port ${port}. Please verify your network/VPN allows outbound SMTP connections on port ${port}, or try switching to Port 465 SSL. (${msg})`;
  }
  if (msg.includes('535') || msg.includes('Username and Password not accepted') || msg.includes('Invalid login')) {
    return `Authentication failed (535). For Gmail, generate a 16-character "App Password" at myaccount.google.com/apppasswords instead of your main account password. (${msg})`;
  }
  return msg;
}

export async function verifySmtpConnection(config: Partial<SmtpConfig>): Promise<{ success: boolean; message: string }> {
  try {
    const host = config.host || '';
    const pass = config.pass || '';

    // Support Resend HTTP API (HTTPS Port 443 - Bypasses raw TCP SMTP port blocks)
    if (host.includes('resend') || pass.startsWith('re_')) {
      if (!pass) {
        return { success: false, message: 'Resend API Key (re_...) is required.' };
      }
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pass.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: 'test@example.com',
          subject: 'SMTP Verification',
          html: '<p>Test</p>',
        }),
      });
      const data = await res.json();
      if (res.status === 200 || res.status === 422 || (data.name && data.name !== 'invalid_api_key')) {
        return { success: true, message: 'Resend HTTP API verified successfully! (Port 443 HTTPS - ISP Bypass)' };
      }
      if (data.message) {
        return { success: false, message: `Resend API Error: ${data.message}` };
      }
    }

    const transporter = createTransporter(config);
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified successfully!' };
  } catch (error: any) {
    console.error('SMTP Verification Error:', error);
    const port = Number(config.port || 465);
    return {
      success: false,
      message: formatSmtpError(error, port),
    };
  }
}

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

export async function sendEmailToRecipient(
  transporter: nodemailer.Transporter | null,
  batchId: string,
  recipientItem: MatchedRecipient,
  template: EmailTemplate,
  smtpConfig: Partial<SmtpConfig>,
  pdfs: PdfFileInfo[],
  baseUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { recipient, matchedPdfId, matchedPdfName } = recipientItem;

  // 1. Email format check
  if (!isValidEmail(recipient.email)) {
    return { success: false, error: `Invalid email format: "${recipient.email}"` };
  }

  // 2. Matched PDF check
  if (!matchedPdfId || recipientItem.status === 'UNMATCHED') {
    return { success: false, error: 'No matching PDF certificate attached.' };
  }

  const pdfInfo = pdfs.find((p) => p.id === matchedPdfId);
  let pdfBuffer: Buffer | null = null;

  if (pdfInfo?.contentBase64) {
    pdfBuffer = Buffer.from(pdfInfo.contentBase64, 'base64');
  } else if (pdfInfo?.url) {
    pdfBuffer = getUploadedPdfBuffer(pdfInfo.url);
  }

  if (!pdfBuffer) {
    return { success: false, error: `PDF file "${matchedPdfName || 'unknown'}" could not be loaded.` };
  }

  // Check size limit (e.g. 15MB limit)
  if (pdfBuffer.length > 15 * 1024 * 1024) {
    return { success: false, error: `PDF file size exceeds 15MB limit (${(pdfBuffer.length / (1024 * 1024)).toFixed(2)}MB).` };
  }

  // 3. Absolute URLs for dual open tracking (pixel + certificate button link)
  const appBaseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'http://localhost:3000';
  const trackingUrl = `${appBaseUrl}/api/track/click?batchId=${batchId}&recipientId=${recipientItem.id}`;
  const trackingPixelHtml = `<img src="${appBaseUrl}/api/track/open?batchId=${batchId}&recipientId=${recipientItem.id}" width="1" height="1" alt="" style="display:none;" />`;

  const subject = interpolateTemplate(template.subject || recipient.subject || 'Your Certificate', recipient, matchedPdfName, trackingUrl);
  const rawBodyHtml = interpolateTemplate(template.bodyHtml || template.bodyText, recipient, matchedPdfName, trackingUrl);
  const bodyText = interpolateTemplate(template.bodyText || template.bodyHtml, recipient, matchedPdfName, trackingUrl);

  const bodyHtml = rawBodyHtml ? `${rawBodyHtml}\n${trackingPixelHtml}` : trackingPixelHtml;

  const fromName = smtpConfig.fromName || 'Certificate Mailer';
  const fromEmail = smtpConfig.fromEmail || smtpConfig.user || process.env.SMTP_USER || 'onboarding@resend.dev';

  // Support Resend HTTP API (HTTPS Port 443) to bypass raw TCP SMTP port blocks
  if (smtpConfig.host?.includes('resend') || smtpConfig.pass?.startsWith('re_')) {
    try {
      const resendApiKey = smtpConfig.pass?.trim();
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: recipient.email,
          subject,
          html: bodyHtml,
          text: bodyText,
          attachments: [
            {
              filename: matchedPdfName || `${recipient.name.replace(/\s+/g, '_')}_Certificate.pdf`,
              content: pdfBuffer.toString('base64'),
            },
          ],
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`Email sent via Resend HTTP API to ${recipient.email}:`, data.id);
        return { success: true, messageId: data.id };
      } else {
        const errStr = data.message || data.error?.message || JSON.stringify(data);
        return { success: false, error: `Resend HTTP API Error: ${errStr}` };
      }
    } catch (err: any) {
      return { success: false, error: `Resend HTTP Error: ${err?.message || String(err)}` };
    }
  }

  if (!transporter) {
    return { success: false, error: 'SMTP transporter is not initialized.' };
  }

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: recipient.email,
    subject,
    text: bodyText,
    html: bodyHtml,
    attachments: [
      {
        filename: matchedPdfName || `${recipient.name.replace(/\s+/g, '_')}_Certificate.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${recipient.email}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`Failed to send email to ${recipient.email}:`, err);
    const port = Number(smtpConfig.port || 465);
    return {
      success: false,
      error: formatSmtpError(err, port),
    };
  }
}

export function pauseBatchSending(batchId: string) {
  const batch = getBatchById(batchId);
  if (batch) {
    batch.status = 'PAUSED';
    saveBatch(batch);
  }
}

export function resumeBatchSending(batchId: string) {
  const batch = getBatchById(batchId);
  if (batch) {
    batch.status = 'SENDING';
    saveBatch(batch);
  }
}

export function cancelBatchSending(batchId: string) {
  const batch = getBatchById(batchId);
  if (batch) {
    batch.status = 'PAUSED';
    saveBatch(batch);
  }
}

/**
 * Serverless Chunking Engine: Processes next chunk of recipients synchronously
 * during HTTP request to ensure compatibility with Netlify/AWS Lambda serverless function execution.
 */
export async function processNextBatchChunk(
  batchId: string,
  onlyFailed = false,
  chunkSize = 2,
  baseUrl?: string
): Promise<{ success: boolean; done: boolean; batch: BatchSession }> {
  const batch = getBatchById(batchId);
  if (!batch) {
    throw new Error('Batch session not found.');
  }

  if (batch.status === 'PAUSED') {
    return { success: true, done: false, batch };
  }

  batch.status = 'SENDING';

  // Mark all excluded/unmatched as SKIPPED
  batch.recipients.forEach((r) => {
    if ((r.status === 'EXCLUDED' || r.status === 'UNMATCHED') && r.sendStatus !== 'SKIPPED') {
      r.sendStatus = 'SKIPPED';
      r.errorDetails = 'Excluded or unmatched recipient.';
    }
  });

  // Find next pending candidates for this chunk
  const candidates = batch.recipients.filter((item) => {
    if (item.status === 'EXCLUDED' || item.status === 'UNMATCHED') return false;
    if (onlyFailed) {
      return item.sendStatus === 'FAILED';
    }
    return item.sendStatus === 'PENDING';
  });

  if (candidates.length === 0) {
    batch.status = 'COMPLETED';
    batch.stats.sent = batch.recipients.filter((r) => r.sendStatus === 'SENT' || r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length;
    batch.stats.delivered = batch.recipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length;
    batch.stats.seen = batch.recipients.filter((r) => r.sendStatus === 'SEEN').length;
    batch.stats.failed = batch.recipients.filter((r) => r.sendStatus === 'FAILED').length;
    batch.stats.pending = 0;
    batch.stats.skipped = batch.recipients.filter((r) => r.sendStatus === 'SKIPPED').length;
    saveBatch(batch);
    return { success: true, done: true, batch };
  }

  const chunk = candidates.slice(0, chunkSize);

  const isResend = batch.smtpConfig?.host?.includes('resend') || batch.smtpConfig?.pass?.startsWith('re_');
  let transporter: nodemailer.Transporter | null = null;

  if (!isResend) {
    try {
      transporter = createTransporter(batch.smtpConfig);
    } catch (err: any) {
      batch.status = 'FAILED';
      saveBatch(batch);
      throw err;
    }
  }

  const delayMs = Number(batch.smtpConfig.throttleDelayMs ?? 1000);

  for (let i = 0; i < chunk.length; i++) {
    const item = chunk[i];
    item.sendStatus = 'SENDING';
    saveBatch(batch);

    const result = await sendEmailToRecipient(transporter, batchId, item, batch.template, batch.smtpConfig, batch.pdfs, baseUrl);

    const now = new Date().toISOString();

    if (result.success) {
      item.sentAt = now;
      item.providerMessageId = result.messageId;
      item.errorDetails = undefined;

      // Update status to DELIVERED once provider handoff succeeds
      // Guard against concurrent webhook updates that may have set status to SEEN
      const currentStatus = item.sendStatus as string;
      if (currentStatus !== 'SEEN') {
        item.sendStatus = 'DELIVERED';
        item.deliveredAt = item.deliveredAt || now;
      }
    } else {
      item.sendStatus = 'FAILED';
      item.errorDetails = result.error;
    }

    // Recalculate stats
    batch.stats.sent = batch.recipients.filter((r) => r.sendStatus === 'SENT' || r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length;
    batch.stats.delivered = batch.recipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length;
    batch.stats.seen = batch.recipients.filter((r) => r.sendStatus === 'SEEN').length;
    batch.stats.failed = batch.recipients.filter((r) => r.sendStatus === 'FAILED').length;
    batch.stats.pending = batch.recipients.filter((r) => r.sendStatus === 'PENDING').length;
    batch.stats.skipped = batch.recipients.filter((r) => r.sendStatus === 'SKIPPED').length;

    saveBatch(batch);

    if (delayMs > 0 && i < chunk.length - 1) {
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }

  const remainingPending = batch.recipients.filter((r) =>
    r.status !== 'EXCLUDED' && r.status !== 'UNMATCHED' &&
    (onlyFailed ? r.sendStatus === 'FAILED' : r.sendStatus === 'PENDING')
  );

  const done = remainingPending.length === 0;
  if (done) {
    batch.status = 'COMPLETED';
  }
  saveBatch(batch);

  return { success: true, done, batch };
}
