import { NextRequest, NextResponse } from 'next/server';
import { getAllBatches, saveBatch } from '@/lib/storage';
import { SendStatus } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const events = Array.isArray(body) ? body : [body];

    const batches = getAllBatches();
    let updatedCount = 0;

    for (const rawEvent of events) {
      const providerMsgId = rawEvent.providerMessageId || rawEvent.sg_message_id || rawEvent.MessageId || rawEvent['message-id'];
      const batchId = rawEvent.batchId || rawEvent.custom_args?.batchId;
      const recipientId = rawEvent.recipientId || rawEvent.custom_args?.recipientId;
      const recipientEmail = (rawEvent.email || rawEvent.recipient || '').toLowerCase().trim();

      const eventType = (rawEvent.event || rawEvent.type || '').toLowerCase();

      let targetStatus: SendStatus | null = null;
      let failReason: string | undefined = undefined;

      if (eventType.includes('deliver')) {
        targetStatus = 'DELIVERED';
      } else if (eventType.includes('open') || eventType.includes('seen')) {
        targetStatus = 'SEEN';
      } else if (eventType.includes('bounce') || eventType.includes('drop') || eventType.includes('fail')) {
        targetStatus = 'FAILED';
        failReason = rawEvent.reason || rawEvent.response || 'Email bounced or dropped by provider.';
      } else if (eventType.includes('sent')) {
        targetStatus = 'SENT';
      }

      if (!targetStatus) continue;

      // Find matching batch and recipient
      for (const batch of batches) {
        if (batchId && batch.id !== batchId) continue;

        const recipient = batch.recipients.find((r) => {
          if (recipientId && r.id === recipientId) return true;
          if (providerMsgId && r.providerMessageId === providerMsgId) return true;
          if (recipientEmail && r.recipient.email.toLowerCase() === recipientEmail) return true;
          return false;
        });

        if (recipient) {
          const now = rawEvent.timestamp ? new Date(rawEvent.timestamp).toISOString() : new Date().toISOString();

          // Enforce idempotent state machine: SENT -> DELIVERED -> SEEN
          if (targetStatus === 'SEEN') {
            recipient.sendStatus = 'SEEN';
            recipient.seenAt = recipient.seenAt || now;
            recipient.deliveredAt = recipient.deliveredAt || now;
          } else if (targetStatus === 'DELIVERED') {
            if (recipient.sendStatus !== 'SEEN') {
              recipient.sendStatus = 'DELIVERED';
              recipient.deliveredAt = recipient.deliveredAt || now;
            }
          } else if (targetStatus === 'FAILED') {
            recipient.sendStatus = 'FAILED';
            recipient.errorDetails = failReason;
          } else if (targetStatus === 'SENT') {
            if (recipient.sendStatus === 'PENDING' || recipient.sendStatus === 'SENDING') {
              recipient.sendStatus = 'SENT';
              recipient.sentAt = recipient.sentAt || now;
            }
          }

          // Recalculate stats
          batch.stats.sent = batch.recipients.filter((r) => r.sendStatus === 'SENT').length;
          batch.stats.delivered = batch.recipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length;
          batch.stats.seen = batch.recipients.filter((r) => r.sendStatus === 'SEEN').length;
          batch.stats.failed = batch.recipients.filter((r) => r.sendStatus === 'FAILED').length;

          saveBatch(batch);
          updatedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to process webhook event.' }, { status: 500 });
  }
}
