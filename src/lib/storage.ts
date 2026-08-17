import fs from 'fs';
import path from 'path';
import os from 'os';
import { BatchSession, EmailTemplate, SmtpConfig } from './types';
import { DEFAULT_EMAIL_TEMPLATES } from './template';

function getDataDir(): string {
  // In serverless environments (Netlify / Vercel / AWS Lambda), process.cwd() is read-only (/var/task).
  // os.tmpdir() points to the writable /tmp directory.
  const isServerless = Boolean(
    process.env.NETLIFY ||
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.env.NODE_ENV === 'production' && !process.env.IS_LOCAL)
  );

  const baseDir = isServerless ? os.tmpdir() : process.cwd();
  return path.join(baseDir, '.diplomail_data');
}

function getUploadsDir(): string {
  return path.join(getDataDir(), 'uploads');
}

/** Public accessor for the uploads directory path (used for path-traversal validation) */
export function getUploadsDirectory(): string {
  return getUploadsDir();
}

function getBatchesFile(): string {
  return path.join(getDataDir(), 'batches.json');
}

function getTemplatesFile(): string {
  return path.join(getDataDir(), 'templates.json');
}

function getSmtpConfigFile(): string {
  return path.join(getDataDir(), 'smtp.json');
}

function ensureDirectories() {
  const dataDir = getDataDir();
  const uploadsDir = getUploadsDir();
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create storage directories:', err);
  }
}

export function saveUploadedPdfFile(id: string, originalName: string, buffer: Buffer): string {
  ensureDirectories();
  const fileName = `${id}_${originalName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
  const filePath = path.join(getUploadsDir(), fileName);
  try {
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.error('Failed to write PDF file to disk:', err);
  }
  return filePath;
}

export function getUploadedPdfBuffer(filePath: string): Buffer | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  } catch (err) {
    console.error('Failed to read PDF file:', filePath, err);
  }
  return null;
}

export function getPdfBufferById(id: string): Buffer | null {
  ensureDirectories();
  const uploadsDir = getUploadsDir();
  try {
    const files = fs.readdirSync(uploadsDir);
    const matchedFile = files.find((f) => f.startsWith(`${id}_`) || f === id);
    if (matchedFile) {
      const fullPath = path.join(uploadsDir, matchedFile);
      return fs.readFileSync(fullPath);
    }
  } catch (err) {
    console.error('Failed to find PDF file by id:', id, err);
  }
  return null;
}

export function getAllBatches(): BatchSession[] {
  ensureDirectories();
  const file = getBatchesFile();
  if (!fs.existsSync(file)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading batches file:', err);
    return [];
  }
}

export function getBatchById(id: string): BatchSession | null {
  const batches = getAllBatches();
  return batches.find((b) => b.id === id) || null;
}

export function saveBatch(batch: BatchSession): void {
  ensureDirectories();
  const file = getBatchesFile();
  const batches = getAllBatches();
  const index = batches.findIndex((b) => b.id === batch.id);

  batch.updatedAt = new Date().toISOString();

  // Save any base64 PDFs to uploads directory for instant inline serving
  if (batch.pdfs && Array.isArray(batch.pdfs)) {
    for (const pdf of batch.pdfs) {
      if (pdf.contentBase64) {
        try {
          const buf = Buffer.from(pdf.contentBase64, 'base64');
          const savedPath = saveUploadedPdfFile(pdf.id, pdf.filename || pdf.originalName, buf);
          if (!pdf.url) {
            pdf.url = savedPath;
          }
        } catch (e) {
          console.warn('Could not cache PDF buffer to disk:', e);
        }
      }
    }
  }

  if (index >= 0) {
    batches[index] = batch;
  } else {
    batches.unshift(batch);
  }

  try {
    fs.writeFileSync(file, JSON.stringify(batches, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write batch to storage:', err);
  }
}

export function deleteBatch(id: string): void {
  ensureDirectories();
  const file = getBatchesFile();
  const batches = getAllBatches();
  const filtered = batches.filter((b) => b.id !== id);
  try {
    fs.writeFileSync(file, JSON.stringify(filtered, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to delete batch from storage:', err);
  }
}

export function getAllTemplates(): EmailTemplate[] {
  ensureDirectories();
  const file = getTemplatesFile();
  if (!fs.existsSync(file)) {
    saveTemplates(DEFAULT_EMAIL_TEMPLATES);
    return DEFAULT_EMAIL_TEMPLATES;
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return DEFAULT_EMAIL_TEMPLATES;
  }
}

export function saveTemplates(templates: EmailTemplate[]): void {
  ensureDirectories();
  const file = getTemplatesFile();
  try {
    fs.writeFileSync(file, JSON.stringify(templates, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save templates:', err);
  }
}

/**
 * NOTE: Password is obfuscated with base64 on disk to prevent casual exposure.
 * This is NOT encryption — do not treat it as secure storage for production secrets.
 * Use environment variables (SMTP_USER, SMTP_PASS) for production deployments.
 */
function obfuscate(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

function deobfuscate(value: string): string {
  try {
    return Buffer.from(value, 'base64').toString('utf-8');
  } catch {
    return value; // Return as-is if not base64 (backward compat)
  }
}

interface StoredSmtpConfig extends Partial<SmtpConfig> {
  _passObf?: string;
}

export function getSavedSmtpConfig(): Partial<SmtpConfig> | null {
  ensureDirectories();
  const file = getSmtpConfigFile();
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const config: StoredSmtpConfig = JSON.parse(raw);
    // De-obfuscate password on read
    if (config._passObf) {
      config.pass = deobfuscate(config._passObf);
      delete config._passObf;
    }
    return config;
  } catch {
    return null;
  }
}

export function saveSmtpConfig(config: Partial<SmtpConfig>): void {
  ensureDirectories();
  const file = getSmtpConfigFile();
  try {
    // Obfuscate password before writing to disk
    const toSave: StoredSmtpConfig = { ...config };
    if (toSave.pass) {
      toSave._passObf = obfuscate(toSave.pass);
      delete toSave.pass;
    }
    fs.writeFileSync(file, JSON.stringify(toSave, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save SMTP config:', err);
  }
}

export interface TrackingEvent {
  batchId: string;
  recipientId: string;
  eventType: 'OPEN' | 'CLICK' | 'DELIVERED';
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

function getEventsFile(): string {
  return path.join(getDataDir(), 'tracking_events.json');
}

export function recordTrackingEvent(event: TrackingEvent): void {
  ensureDirectories();
  const file = getEventsFile();
  let events: TrackingEvent[] = [];
  try {
    if (fs.existsSync(file)) {
      events = JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {
    console.warn('Error reading tracking events file:', e);
  }

  const isDuplicate = events.some(
    (e) => e.batchId === event.batchId && e.recipientId === event.recipientId && e.eventType === event.eventType
  );

  if (!isDuplicate) {
    events.push(event);
    try {
      fs.writeFileSync(file, JSON.stringify(events.slice(-500), null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed writing tracking event:', e);
    }
  }
}

export function getTrackingEvents(batchId: string): TrackingEvent[] {
  ensureDirectories();
  const file = getEventsFile();
  try {
    if (fs.existsSync(file)) {
      const events: TrackingEvent[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return events.filter((e) => e.batchId === batchId);
    }
  } catch (e) {
    console.error('Error reading tracking events:', e);
  }
  return [];
}

