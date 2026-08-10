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
  } catch (err) {
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

export function getSavedSmtpConfig(): Partial<SmtpConfig> | null {
  ensureDirectories();
  const file = getSmtpConfigFile();
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function saveSmtpConfig(config: Partial<SmtpConfig>): void {
  ensureDirectories();
  const file = getSmtpConfigFile();
  try {
    fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save SMTP config:', err);
  }
}
