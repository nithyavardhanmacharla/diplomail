export type MatchStatus = 'MATCHED_EXACT' | 'MATCHED_FUZZY' | 'UNMATCHED' | 'MANUAL_OVERRIDE' | 'EXCLUDED';

export type SendStatus = 'PENDING' | 'SENDING' | 'SENT' | 'DELIVERED' | 'SEEN' | 'FAILED' | 'SKIPPED';

export interface RecipientRow {
  id: string;
  name: string;
  email: string;
  subject?: string;
  customMessage?: string;
  extraData?: Record<string, string>;
}

export interface PdfFileInfo {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  url?: string;
  contentBase64?: string;
}

export interface MatchedRecipient {
  id: string;
  recipient: RecipientRow;
  matchedPdfId: string | null;
  matchedPdfName: string | null;
  status: MatchStatus;
  confidenceScore: number; // 0 to 1
  sendStatus: SendStatus;
  providerMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  seenAt?: string;
  errorDetails?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  isDefault?: boolean;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for 587 / 25
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  throttleDelayMs: number; // e.g. 1000ms delay between emails
  batchSize: number; // e.g. 50 emails per batch
}

export interface BatchSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  recipients: MatchedRecipient[];
  pdfs: PdfFileInfo[];
  template: EmailTemplate;
  smtpConfig: Partial<SmtpConfig>;
  stats: {
    total: number;
    matched: number;
    unmatched: number;
    sent: number;
    delivered?: number;
    seen?: number;
    failed: number;
    pending: number;
    skipped: number;
  };
  status: 'DRAFT' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
}

export interface EmailStatusWebhookPayload {
  event: 'sent' | 'delivered' | 'open' | 'click' | 'bounce' | 'dropped';
  providerMessageId?: string;
  batchId?: string;
  recipientId?: string;
  email?: string;
  timestamp?: string;
  reason?: string;
}
