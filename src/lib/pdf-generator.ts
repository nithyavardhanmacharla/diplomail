import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface GenerateCertificateOptions {
  recipientName: string;
  recipientEmail?: string;
  certificateTitle?: string;
  issueDate?: string;
  batchId?: string;
  recipientId?: string;
  filename?: string;
}

/**
 * Dynamically generates a verified, high-resolution landscape certificate PDF.
 * Used to guarantee that clicking "Download Certificate" in emails always serves
 * a real, valid PDF document directly in the browser viewer, even across serverless cold starts.
 */
export async function generateCertificatePdf(options: GenerateCertificateOptions): Promise<Buffer> {
  const {
    recipientName = 'Recipient',
    certificateTitle = 'Certificate of Accomplishment',
    issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    batchId,
    recipientId,
  } = options;

  const pdfDoc = await PDFDocument.create();

  // A4 Landscape: 842 x 595 points
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();

  // Embed standard clean fonts
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontTimesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  // Background Fill (Clean Warm White / Slate Tint)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.99, 0.99, 1.0),
  });

  // Corner Accent Geometry (Modern Minimalist Border)
  // Outer Border (Royal Indigo)
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: rgb(0.31, 0.27, 0.90), // #4f46e5
    borderWidth: 3,
  });

  // Inner Accent Border (Warm Gold)
  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: rgb(0.85, 0.68, 0.25), // #d97706 / Gold
    borderWidth: 1.2,
  });

  // Header Title
  const cleanTitle = (certificateTitle || 'Certificate of Completion').toUpperCase();
  const titleSize = cleanTitle.length > 30 ? 20 : 24;
  const titleWidth = fontBold.widthOfTextAtSize(cleanTitle, titleSize);
  page.drawText(cleanTitle, {
    x: (width - titleWidth) / 2,
    y: height - 90,
    size: titleSize,
    font: fontBold,
    color: rgb(0.20, 0.18, 0.55),
  });

  // Sub-header Text
  const subText = 'THIS IS PROUDLY PRESENTED TO';
  const subWidth = fontBold.widthOfTextAtSize(subText, 11);
  page.drawText(subText, {
    x: (width - subWidth) / 2,
    y: height - 135,
    size: 11,
    font: fontBold,
    color: rgb(0.45, 0.50, 0.60),
  });

  // Recipient Name (Prominent & Elegant)
  const nameText = recipientName.trim() || 'Honored Recipient';
  const nameSize = nameText.length > 25 ? 32 : 40;
  const nameWidth = fontTimes.widthOfTextAtSize(nameText, nameSize);
  page.drawText(nameText, {
    x: (width - nameWidth) / 2,
    y: height - 200,
    size: nameSize,
    font: fontTimes,
    color: rgb(0.08, 0.12, 0.25),
  });

  // Elegant Gold Underline beneath recipient name
  const underlineWidth = Math.max(nameWidth + 60, 360);
  page.drawLine({
    start: { x: (width - underlineWidth) / 2, y: height - 215 },
    end: { x: (width + underlineWidth) / 2, y: height - 215 },
    thickness: 2,
    color: rgb(0.85, 0.68, 0.25),
  });

  // Body Paragraph / Citation
  const citationLine1 = 'in formal recognition of outstanding participation, demonstrated excellence,';
  const citationLine2 = 'and the successful fulfillment of all prescribed requirements and standards.';

  const c1Width = fontTimesItalic.widthOfTextAtSize(citationLine1, 14);
  page.drawText(citationLine1, {
    x: (width - c1Width) / 2,
    y: height - 265,
    size: 14,
    font: fontTimesItalic,
    color: rgb(0.25, 0.30, 0.40),
  });

  const c2Width = fontTimesItalic.widthOfTextAtSize(citationLine2, 14);
  page.drawText(citationLine2, {
    x: (width - c2Width) / 2,
    y: height - 290,
    size: 14,
    font: fontTimesItalic,
    color: rgb(0.25, 0.30, 0.40),
  });

  // Date Section (Left)
  page.drawLine({
    start: { x: 75, y: 125 },
    end: { x: 255, y: 125 },
    thickness: 1,
    color: rgb(0.70, 0.75, 0.82),
  });
  const dateStr = `Date of Issue: ${issueDate}`;
  const dateWidth = fontRegular.widthOfTextAtSize(dateStr, 11);
  page.drawText(dateStr, {
    x: 75 + (180 - dateWidth) / 2,
    y: 105,
    size: 11,
    font: fontRegular,
    color: rgb(0.35, 0.40, 0.50),
  });

  // Official Verified Badge (Center)
  const badgeText = '★ OFFICIAL VERIFIED CREDENTIAL ★';
  const badgeWidth = fontBold.widthOfTextAtSize(badgeText, 10);
  page.drawText(badgeText, {
    x: (width - badgeWidth) / 2,
    y: 115,
    size: 10,
    font: fontBold,
    color: rgb(0.85, 0.65, 0.15),
  });

  const platformText = 'Dispatched & Authenticated via DiploMail';
  const platformWidth = fontRegular.widthOfTextAtSize(platformText, 9);
  page.drawText(platformText, {
    x: (width - platformWidth) / 2,
    y: 98,
    size: 9,
    font: fontRegular,
    color: rgb(0.50, 0.55, 0.65),
  });

  // Signature Section (Right)
  page.drawLine({
    start: { x: width - 255, y: 125 },
    end: { x: width - 75, y: 125 },
    thickness: 1,
    color: rgb(0.70, 0.75, 0.82),
  });
  const sigText = 'Authorized Signature';
  const sigWidth = fontRegular.widthOfTextAtSize(sigText, 11);
  page.drawText(sigText, {
    x: width - 255 + (180 - sigWidth) / 2,
    y: 105,
    size: 11,
    font: fontRegular,
    color: rgb(0.35, 0.40, 0.50),
  });

  // Unique Credential Serial ID at Bottom
  const serialSeed = (recipientId || recipientName || 'CERT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const serialId = `Credential ID: CERT-${serialSeed.slice(0, 8)}-${(batchId || 'DIPLO').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
  const serialWidth = fontRegular.widthOfTextAtSize(serialId, 9);
  page.drawText(serialId, {
    x: (width - serialWidth) / 2,
    y: 45,
    size: 9,
    font: fontRegular,
    color: rgb(0.55, 0.60, 0.70),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
