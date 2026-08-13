import { NextRequest, NextResponse } from 'next/server';
import { verifySmtpConnection } from '@/lib/email-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await verifySmtpConnection(body);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'SMTP Test failed.' }, { status: 500 });
  }
}
