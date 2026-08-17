import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { RecipientRow, PdfFileInfo, BatchSession, EmailTemplate, SmtpConfig } from './types';
import { matchRecipientsToPdfs } from './matching';
import { DEFAULT_EMAIL_TEMPLATES } from './template';

/**
 * Converts ArrayBuffer or Uint8Array to base64 string safely without stack overflow.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Parse recipient spreadsheet directly in browser. Supports .csv, .txt, .xlsx, .xls
 */
export async function parseSpreadsheetClient(file: File): Promise<RecipientRow[]> {
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  const recipients: RecipientRow[] = [];

  if (fileExt === 'csv' || fileExt === 'txt') {
    const csvText = await file.text();
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    parsed.data.forEach((row, index) => {
      const keys = Object.keys(row);
      const nameKey = keys.find((k) => /name/i.test(k)) || keys[0];
      const emailKey = keys.find((k) => /email|mail/i.test(k)) || keys[1];
      const subjectKey = keys.find((k) => /subject/i.test(k));
      const messageKey = keys.find((k) => /message|custom/i.test(k));

      const nameVal = (row[nameKey] || '').trim();
      const emailVal = (row[emailKey] || '').trim();

      if (nameVal || emailVal) {
        recipients.push({
          id: `rec_${index + 1}_${Math.random().toString(36).substring(2, 7)}`,
          name: nameVal,
          email: emailVal,
          subject: subjectKey ? (row[subjectKey] || '').trim() : undefined,
          customMessage: messageKey ? (row[messageKey] || '').trim() : undefined,
          extraData: row,
        });
      }
    });
  } else if (fileExt === 'xlsx' || fileExt === 'xls') {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    rows.forEach((row, index) => {
      const keys = Object.keys(row);
      const nameKey = keys.find((k) => /name/i.test(k)) || keys[0];
      const emailKey = keys.find((k) => /email|mail/i.test(k)) || keys[1];
      const subjectKey = keys.find((k) => /subject/i.test(k));
      const messageKey = keys.find((k) => /message|custom/i.test(k));

      const nameVal = String(row[nameKey] || '').trim();
      const emailVal = String(row[emailKey] || '').trim();

      if (nameVal || emailVal) {
        const stringRow: Record<string, string> = {};
        Object.entries(row).forEach(([k, v]) => {
          stringRow[k] = String(v ?? '');
        });

        recipients.push({
          id: `rec_${index + 1}_${Math.random().toString(36).substring(2, 7)}`,
          name: nameVal,
          email: emailVal,
          subject: subjectKey ? String(row[subjectKey] || '').trim() : undefined,
          customMessage: messageKey ? String(row[messageKey] || '').trim() : undefined,
          extraData: stringRow,
        });
      }
    });
  } else {
    throw new Error('Unsupported spreadsheet format. Please upload a .csv, .xlsx, or .xls file.');
  }

  if (recipients.length === 0) {
    throw new Error('No recipient records found in spreadsheet. Ensure columns for Name and Email exist.');
  }

  return recipients;
}

/**
 * Process uploaded PDF / ZIP files in browser.
 */
export async function processPdfsClient(
  files: File[],
  recipients: RecipientRow[],
  onProgress?: (status: string, current: number, total: number) => void
): Promise<PdfFileInfo[]> {
  const pdfList: PdfFileInfo[] = [];
  const onlyPdfs = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
  const hasZip = files.some((f) => f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip');
  const isSinglePdf = onlyPdfs.length === 1 && !hasZip;

  // Single PDF upload - Check if multi-page to split
  if (isSinglePdf) {
    const file = onlyPdfs[0];
    onProgress?.('Inspecting PDF document...', 1, 1);
    const arrayBuffer = await file.arrayBuffer();

    try {
      const srcDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = srcDoc.getPageCount();

      if (pageCount > 1) {
        onProgress?.(`Splitting ${pageCount} pages...`, 0, pageCount);
        for (let i = 0; i < pageCount; i++) {
          onProgress?.(`Extracting page ${i + 1} of ${pageCount}...`, i + 1, pageCount);
          const newDoc = await PDFDocument.create();
          const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
          newDoc.addPage(copiedPage);

          const pdfBytes = await newDoc.save();
          const pageBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(pageBlob);
          const base64 = arrayBufferToBase64(pdfBytes);

          // Best guess recipient match by page index or generic name
          const matchedCandidate = recipients[i]?.name || `Page_${i + 1}`;
          const safeName = matchedCandidate.replace(/[^a-zA-Z0-9_\-.]/g, '_');
          const filename = `${safeName}.pdf`;
          const pdfId = `pdf_${Math.random().toString(36).substring(2, 9)}`;

          pdfList.push({
            id: pdfId,
            filename,
            originalName: filename,
            size: pdfBytes.length,
            blobUrl,
            contentBase64: base64,
          });
        }
        return pdfList;
      }
    } catch (e) {
      console.warn('PDF multi-page inspect fallback:', e);
    }

    // Single page PDF
    const blobUrl = URL.createObjectURL(file);
    const base64 = arrayBufferToBase64(arrayBuffer);
    const pdfId = `pdf_${Math.random().toString(36).substring(2, 9)}`;

    pdfList.push({
      id: pdfId,
      filename: file.name,
      originalName: file.name,
      size: file.size,
      blobUrl,
      contentBase64: base64,
    });

    return pdfList;
  }

  // Multiple files or ZIP archives
  let processed = 0;
  const total = files.length;

  for (const file of files) {
    processed++;
    onProgress?.(`Processing certificate ${processed} of ${total}...`, processed, total);

    const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';

    if (isZip) {
      const zipArrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(zipArrayBuffer);
      const zipEntries = Object.keys(zip.files);

      for (const relativePath of zipEntries) {
        const zipEntry = zip.files[relativePath];
        if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.pdf')) {
          const entryBuffer = await zipEntry.async('arraybuffer');
          const entryBlob = new Blob([entryBuffer], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(entryBlob);
          const base64 = arrayBufferToBase64(entryBuffer);
          const basename = relativePath.split('/').pop() || relativePath;
          const pdfId = `pdf_${Math.random().toString(36).substring(2, 9)}`;

          pdfList.push({
            id: pdfId,
            filename: basename,
            originalName: basename,
            size: entryBuffer.byteLength,
            blobUrl,
            contentBase64: base64,
          });
        }
      }
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const blobUrl = URL.createObjectURL(file);
      const base64 = arrayBufferToBase64(arrayBuffer);
      const pdfId = `pdf_${Math.random().toString(36).substring(2, 9)}`;

      pdfList.push({
        id: pdfId,
        filename: file.name,
        originalName: file.name,
        size: file.size,
        blobUrl,
        contentBase64: base64,
      });
    }
  }

  if (pdfList.length === 0) {
    throw new Error('No valid PDF files found in the uploaded files or ZIP archive.');
  }

  return pdfList;
}

/**
 * Creates and initializes a complete BatchSession on the client.
 */
export function createClientBatchSession(
  spreadsheetName: string,
  recipients: RecipientRow[],
  pdfs: PdfFileInfo[],
  template?: EmailTemplate,
  smtpConfig?: Partial<SmtpConfig>
): BatchSession {
  const matchedRecipients = matchRecipientsToPdfs(recipients, pdfs);
  const defaultTemplate = template || DEFAULT_EMAIL_TEMPLATES[0];

  const matchedCount = matchedRecipients.filter(
    (r) => r.status === 'MATCHED_EXACT' || r.status === 'MATCHED_FUZZY' || r.status === 'MANUAL_OVERRIDE'
  ).length;
  const unmatchedCount = matchedRecipients.length - matchedCount;

  const batchSession: BatchSession = {
    id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: `Batch - ${spreadsheetName} (${recipients.length} recipients)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recipients: matchedRecipients,
    pdfs,
    template: defaultTemplate,
    smtpConfig: smtpConfig || {},
    stats: {
      total: matchedRecipients.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      sent: 0,
      delivered: 0,
      seen: 0,
      failed: 0,
      pending: matchedRecipients.length,
      skipped: 0,
    },
    status: 'READY',
  };

  // Save to client localStorage for persistence
  try {
    if (typeof window !== 'undefined') {
      const existingRaw = localStorage.getItem('diplomail_batches');
      const existing: BatchSession[] = existingRaw ? JSON.parse(existingRaw) : [];
      // Strip large base64 in localStorage to keep within 5MB quota
      const lightweightBatch: BatchSession = {
        ...batchSession,
        pdfs: batchSession.pdfs.map((p) => ({
          id: p.id,
          filename: p.filename,
          originalName: p.originalName,
          size: p.size,
        })),
      };
      const updated = [lightweightBatch, ...existing.filter((b) => b.id !== batchSession.id)].slice(0, 20);
      localStorage.setItem('diplomail_batches', JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('localStorage batch save warning:', e);
  }

  return batchSession;
}
