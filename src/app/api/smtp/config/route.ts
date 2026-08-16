import { NextRequest, NextResponse } from 'next/server';
import { getSavedSmtpConfig, saveSmtpConfig } from '@/lib/storage';
import { notifySmtpEstablished } from '@/lib/email-service';

export async function GET() {
  const config = getSavedSmtpConfig() || {};
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  try {
    const config = await req.json();
    saveSmtpConfig(config);
    if (config?.pass) {
      notifySmtpEstablished(config).catch((err) => console.error('Failed to notify admin on SMTP config save:', err));
    }
    return NextResponse.json({ success: true, config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save SMTP config.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
