import { NextRequest, NextResponse } from 'next/server';
import { getBatchById, saveBatch, deleteBatch } from '@/lib/storage';
import { MatchStatus } from '@/lib/types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = getBatchById(id);
  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }
  return NextResponse.json({ batch });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = getBatchById(id);
  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  const body = await req.json();

  // Input validation: ensure expected types
  if (body.recipientUpdates !== undefined) {
    if (!Array.isArray(body.recipientUpdates)) {
      return NextResponse.json({ error: 'recipientUpdates must be an array.' }, { status: 400 });
    }
    for (const upd of body.recipientUpdates) {
      if (typeof upd !== 'object' || upd === null || typeof upd.recipientId !== 'string') {
        return NextResponse.json({ error: 'Each recipientUpdate must have a string recipientId.' }, { status: 400 });
      }
    }
  }
  if (body.template !== undefined && (typeof body.template !== 'object' || body.template === null)) {
    return NextResponse.json({ error: 'template must be an object.' }, { status: 400 });
  }
  if (body.smtpConfig !== undefined && (typeof body.smtpConfig !== 'object' || body.smtpConfig === null)) {
    return NextResponse.json({ error: 'smtpConfig must be an object.' }, { status: 400 });
  }

  if (body.recipientUpdates) {
    // Array of { recipientId: string, matchedPdfId: string | null, status: MatchStatus }
    body.recipientUpdates.forEach((upd: { recipientId: string; matchedPdfId?: string | null; status?: MatchStatus }) => {
      const item = batch.recipients.find((r) => r.id === upd.recipientId);
      if (item) {
        if (upd.matchedPdfId !== undefined) {
          item.matchedPdfId = upd.matchedPdfId;
          const pdf = batch.pdfs.find((p) => p.id === upd.matchedPdfId);
          item.matchedPdfName = pdf ? pdf.originalName : null;
        }
        if (upd.status) {
          item.status = upd.status;
        }
      }
    });
  }

  if (body.template) {
    batch.template = body.template;
  }

  if (body.smtpConfig) {
    batch.smtpConfig = { ...batch.smtpConfig, ...body.smtpConfig };
  }

  // Recalculate stats
  batch.stats.matched = batch.recipients.filter((r) => r.status === 'MATCHED_EXACT' || r.status === 'MATCHED_FUZZY' || r.status === 'MANUAL_OVERRIDE').length;
  batch.stats.unmatched = batch.recipients.filter((r) => r.status === 'UNMATCHED').length;
  batch.stats.skipped = batch.recipients.filter((r) => r.status === 'EXCLUDED').length;

  saveBatch(batch);

  return NextResponse.json({ success: true, batch });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteBatch(id);
  return NextResponse.json({ success: true });
}
