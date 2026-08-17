import { NextRequest, NextResponse } from 'next/server';
import { processNextBatchChunk, createTransporter } from '@/lib/email-service';
import { getBatchById, saveBatch } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const { batchId, action, smtpConfig, template, onlyFailed, batch: incomingBatch } = await req.json();

    const effectiveBatchId = batchId || incomingBatch?.id;
    if (!effectiveBatchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }

    let batch = getBatchById(effectiveBatchId);
    if (!batch && incomingBatch) {
      batch = incomingBatch;
    }

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    if (incomingBatch?.pdfs && (!batch.pdfs || batch.pdfs.length === 0 || !batch.pdfs[0].contentBase64)) {
      batch.pdfs = incomingBatch.pdfs;
    }

    saveBatch(batch);

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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'SMTP Credentials missing. Please configure your sender email login in SMTP settings.';
        return NextResponse.json(
          { error: message },
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
    const result = await processNextBatchChunk(effectiveBatchId, Boolean(onlyFailed), 2, baseUrl, batch);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Batch send API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process batch sending.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
