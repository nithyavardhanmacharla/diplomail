import { NextRequest, NextResponse } from 'next/server';
import { processNextBatchChunk, createTransporter } from '@/lib/email-service';
import { getBatchById, saveBatch } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const { batchId, action, smtpConfig, template, onlyFailed } = await req.json();

    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }

    const batch = getBatchById(batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    if (action === 'PAUSE') {
      batch.status = 'PAUSED';
      saveBatch(batch);
      return NextResponse.json({ success: true, message: 'Batch sending paused.', batch });
    }

    if (action === 'RESUME') {
      batch.status = 'SENDING';
      saveBatch(batch);
    }

    if (smtpConfig) {
      batch.smtpConfig = { ...batch.smtpConfig, ...smtpConfig };
    }
    if (template) {
      batch.template = template;
    }

    // Validate SMTP credentials before starting (skip for Resend HTTP mode)
    const isResend = batch.smtpConfig?.host?.includes('resend') || batch.smtpConfig?.pass?.startsWith('re_');
    if (!isResend) {
      try {
        createTransporter(batch.smtpConfig);
      } catch (err: any) {
        return NextResponse.json(
          { error: err?.message || 'SMTP Credentials missing. Please configure your sender email login in SMTP settings.' },
          { status: 400 }
        );
      }
    }

    saveBatch(batch);

    // Extract dynamic request origin (e.g. https://diplomail.netlify.app or http://localhost:3000)
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const baseUrl = `${protocol}://${host}`;

    // Synchronously process the next chunk of recipients
    const result = await processNextBatchChunk(batchId, !!onlyFailed, 2, baseUrl);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Batch send API error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to process batch sending.' }, { status: 500 });
  }
}
