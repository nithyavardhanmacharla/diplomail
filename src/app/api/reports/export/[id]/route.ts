import { NextRequest, NextResponse } from 'next/server';
import { getBatchById } from '@/lib/storage';
import Papa from 'papaparse';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = getBatchById(id);

  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  const rows = batch.recipients.map((item) => ({
    Name: item.recipient.name,
    Email: item.recipient.email,
    'Matched PDF': item.matchedPdfName || 'N/A',
    'Match Confidence': `${Math.round(item.confidenceScore * 100)}%`,
    'Match Type': item.status,
    'Send Status': item.sendStatus,
    'Sent Timestamp': item.sentAt || '',
    'Delivered Timestamp': item.deliveredAt || '',
    'Seen Timestamp': item.seenAt || '',
    'Provider Message ID': item.providerMessageId || '',
    'Error / Fail Reason': item.errorDetails || '',
  }));

  const csv = Papa.unparse(rows);

  const filename = `diplomail_report_${batch.id}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
