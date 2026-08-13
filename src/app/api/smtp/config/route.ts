import { NextRequest, NextResponse } from 'next/server';
import { getSavedSmtpConfig, saveSmtpConfig } from '@/lib/storage';

export async function GET() {
  const config = getSavedSmtpConfig() || {};
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  try {
    const config = await req.json();
    saveSmtpConfig(config);
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save SMTP config.' }, { status: 500 });
  }
}
