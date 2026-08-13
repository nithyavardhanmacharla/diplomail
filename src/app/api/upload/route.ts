import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import path from 'path';
import { RecipientRow, PdfFileInfo, BatchSession } from '@/lib/types';
import { matchRecipientsToPdfs } from '@/lib/matching';
import { saveUploadedPdfFile, saveBatch, getSavedSmtpConfig, getAllTemplates, getUploadedPdfBuffer, getUploadsDirectory } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pdfPath = searchParams.get('pdfPath');

    if (!pdfPath) {
      return NextResponse.json({ error: 'pdfPath is required' }, { status: 400 });
    }

    // Security: Resolve the path and validate it's within the allowed uploads directory
    const resolvedPath = path.resolve(pdfPath);
    const uploadsDir = path.resolve(getUploadsDirectory());
    if (!resolvedPath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Access denied: invalid file path.' }, { status: 403 });
    }

    const buffer = getUploadedPdfBuffer(resolvedPath);
    if (!buffer) {
      return NextResponse.json({ error: 'PDF file not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch PDF.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const spreadsheetFile = formData.get('spreadsheet') as File | null;
    const pdfFiles = formData.getAll('pdfs') as File[];

    if (!spreadsheetFile) {
      return NextResponse.json({ error: 'Please upload a CSV or Excel file.' }, { status: 400 });
    }

    // 1. Parse Spreadsheet (CSV / Excel)
    const spreadsheetBuffer = Buffer.from(await spreadsheetFile.arrayBuffer());
    const recipients: RecipientRow[] = [];

    const fileExt = spreadsheetFile.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv' || fileExt === 'txt') {
      const csvText = spreadsheetBuffer.toString('utf-8');
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

        if (row[nameKey] || row[emailKey]) {
          recipients.push({
            id: `rec_${index + 1}_${Math.random().toString(36).substring(2, 7)}`,
            name: (row[nameKey] || '').trim(),
            email: (row[emailKey] || '').trim(),
            subject: subjectKey ? (row[subjectKey] || '').trim() : undefined,
            customMessage: messageKey ? (row[messageKey] || '').trim() : undefined,
            extraData: row,
          });
        }
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.read(spreadsheetBuffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      rows.forEach((row, index) => {
        const keys = Object.keys(row);
        const nameKey = keys.find((k) => /name/i.test(k)) || keys[0];
        const emailKey = keys.find((k) => /email|mail/i.test(k)) || keys[1];
        const subjectKey = keys.find((k) => /subject/i.test(k));
        const messageKey = keys.find((k) => /message|custom/i.test(k));

        if (row[nameKey] || row[emailKey]) {
          recipients.push({
            id: `rec_${index + 1}_${Math.random().toString(36).substring(2, 7)}`,
            name: String(row[nameKey] || '').trim(),
            email: String(row[emailKey] || '').trim(),
            subject: subjectKey ? String(row[subjectKey] || '').trim() : undefined,
            customMessage: messageKey ? String(row[messageKey] || '').trim() : undefined,
            extraData: row,
          });
        }
      });
    } else {
      return NextResponse.json({ error: 'Unsupported file format. Please upload a .csv or .xlsx file.' }, { status: 400 });
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipient rows found in spreadsheet.' }, { status: 400 });
    }

    // 2. Extract PDFs (or unpack ZIP)
    const pdfList: PdfFileInfo[] = [];

    for (const file of pdfFiles) {
      const isZip = file.name.endsWith('.zip') || file.type === 'application/zip';

      if (isZip) {
        const zipBuffer = Buffer.from(await file.arrayBuffer());
        const zip = await JSZip.loadAsync(zipBuffer);

        for (const relativePath of Object.keys(zip.files)) {
          const zipEntry = zip.files[relativePath];
          if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.pdf')) {
            const pdfBuf = await zipEntry.async('nodebuffer');
            const pdfId = `pdf_${Math.random().toString(36).substring(2, 9)}`;
            const basename = relativePath.split('/').pop() || relativePath;
            const savedPath = saveUploadedPdfFile(pdfId, basename, pdfBuf);

            pdfList.push({
              id: pdfId,
              filename: basename,
              originalName: basename,
              size: pdfBuf.length,
              url: savedPath,
              contentBase64: pdfBuf.toString('base64'),
            });
          }
        }
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const pdfBuf = Buffer.from(await file.arrayBuffer());
        const pdfId = `pdf_${Math.random().toString(36).substring(2, 9)}`;
        const savedPath = saveUploadedPdfFile(pdfId, file.name, pdfBuf);

        pdfList.push({
          id: pdfId,
          filename: file.name,
          originalName: file.name,
          size: pdfBuf.length,
          url: savedPath,
          contentBase64: pdfBuf.toString('base64'),
        });
      }
    }

    // 3. Smart Matching
    const matchedRecipients = matchRecipientsToPdfs(recipients, pdfList);

    // 4. Build Batch Session
    const templates = getAllTemplates();
    const defaultTemplate = templates.find((t) => t.isDefault) || templates[0];
    const savedSmtp = getSavedSmtpConfig() || {};

    const matchedCount = matchedRecipients.filter((r) => r.status === 'MATCHED_EXACT' || r.status === 'MATCHED_FUZZY').length;
    const unmatchedCount = matchedRecipients.length - matchedCount;

    const batchSession: BatchSession = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `Batch - ${spreadsheetFile.name} (${recipients.length} recipients)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recipients: matchedRecipients,
      pdfs: pdfList,
      template: defaultTemplate,
      smtpConfig: savedSmtp,
      stats: {
        total: matchedRecipients.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        sent: 0,
        failed: 0,
        pending: matchedRecipients.length,
        skipped: 0,
      },
      status: 'READY',
    };

    saveBatch(batchSession);

    return NextResponse.json({ success: true, batch: batchSession });
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to process files.' }, { status: 500 });
  }
}
