import { RecipientRow } from './types';

/**
 * Interpolates variables like {{name}}, {{email}}, {{customMessage}}, {{trackingUrl}}, etc. into a template string.
 */
export function interpolateTemplate(
  template: string,
  recipient: RecipientRow,
  matchedPdfName?: string | null,
  trackingUrl?: string
): string {
  if (!template) return '';

  let result = template;

  const data: Record<string, string> = {
    name: recipient.name || '',
    email: recipient.email || '',
    subject: recipient.subject || '',
    custommessage: recipient.customMessage || '',
    custom_message: recipient.customMessage || '',
    filename: matchedPdfName || '',
    trackingurl: trackingUrl || '#',
    tracking_url: trackingUrl || '#',
    ...(recipient.extraData || {}),
  };

  // Replace {{var}} or {{ var }}
  result = result.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey in data) {
      return data[lowerKey];
    }
    // Also check case-sensitive original extraData keys
    if (recipient.extraData && key in recipient.extraData) {
      return recipient.extraData[key];
    }
    return match; // return as-is if variable key not found
  });

  return result;
}

export const DEFAULT_EMAIL_TEMPLATES = [
  {
    id: 'default-cert',
    name: 'Standard Certificate Award',
    subject: 'Your Certificate of Completion: {{name}}',
    bodyHtml: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
  <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Certificate of Accomplishment</h1>
  </div>
  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 32px 24px;">
    <p style="font-size: 16px;">Dear <strong>{{name}}</strong>,</p>
    <p>We are delighted to present your official Certificate of Completion attached to this email.</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: 600; color: #475569;">Recipient Details:</p>
      <p style="margin: 4px 0 0 0; color: #64748b;">Name: {{name}}<br>Email: {{email}}</p>
    </div>
    <p>{{customMessage}}</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{{trackingUrl}}" target="_blank" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
        📥 Download Certificate
      </a>
    </div>
    <p style="font-size: 13px; color: #64748b;">Your personalized certificate (<code>{{filename}}</code>) is also attached directly to this email as a PDF document.</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="font-size: 14px; color: #94a3b8; margin: 0; text-align: center;">Sent via DiploMail</p>
  </div>
</div>`,
    bodyText: `Dear {{name}},\n\nWe are delighted to present your official Certificate of Completion attached to this email.\n\nName: {{name}}\nEmail: {{email}}\n\n{{customMessage}}\n\nDownload Certificate: {{trackingUrl}}\n\nPlease find your personalized certificate ({{filename}}) attached.\n\nBest regards,\nDiploMail`,
    isDefault: true,
  },
  {
    id: 'simple-notification',
    name: 'Simple Document Delivery',
    subject: 'Document Attached: {{name}}',
    bodyHtml: `<div style="font-family: sans-serif; padding: 20px; color: #333;">
  <h2>Hello {{name}},</h2>
  <p>Please find your requested PDF document (<strong>{{filename}}</strong>) attached to this email.</p>
  <p>{{customMessage}}</p>
  <p style="margin: 20px 0;"><a href="{{trackingUrl}}" style="background-color: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">📥 Download Certificate</a></p>
  <p>Thank you!</p>
</div>`,
    bodyText: `Hello {{name}},\n\nPlease find your requested PDF document ({{filename}}) attached to this email.\n\nDownload Certificate: {{trackingUrl}}\n\n{{customMessage}}\n\nThank you!`,
    isDefault: false,
  }
];
