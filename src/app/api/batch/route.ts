import { NextRequest, NextResponse } from 'next/server';
import { saveBatch, getAllBatches } from '@/lib/storage';
import { BatchSession } from '@/lib/types';

export async function GET() {
  try {
    const batches = getAllBatches();
    return NextResponse.json({ success: true, batches });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve batches.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const batch: BatchSession = body.batch || body;

    if (!batch || !batch.id) {
      return NextResponse.json({ error: 'Valid batch object with id is required.' }, { status: 400 });
    }

    saveBatch(batch);
    return NextResponse.json({ success: true, batch });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save batch.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
