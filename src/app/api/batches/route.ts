import { NextResponse } from 'next/server';
import { getAllBatches } from '@/lib/storage';

export async function GET() {
  const batches = getAllBatches();
  return NextResponse.json({ batches });
}
