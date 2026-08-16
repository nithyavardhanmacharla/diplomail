'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, FileArchive, CheckCircle, AlertTriangle, ArrowRight, Download, Sparkles, X, Scissors } from 'lucide-react';
import { BatchSession } from '@/lib/types';

interface UploadStepProps {
  onUploadSuccess: (batch: BatchSession) => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({ onUploadSuccess }) => {
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const spreadsheetInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleSpreadsheetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (/\.(csv|xlsx|xls)$/i.test(file.name)) {
        setSpreadsheet(file);
        setErrorMessage(null);
      } else {
        setErrorMessage('Please upload a valid CSV or Excel file (.csv, .xlsx, .xls)');
      }
    }
  };

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const validFiles = files.filter((f) => /\.(pdf|zip)$/i.test(f.name));
      if (validFiles.length > 0) {
        setPdfs((prev) => [...prev, ...validFiles]);
        setErrorMessage(null);
      } else {
        setErrorMessage('Please upload PDF files (.pdf) or a ZIP file (.zip)');
      }
    }
  };

  const handleProcessUpload = async () => {
    if (!spreadsheet) {
      setErrorMessage('Please select a CSV or Excel spreadsheet.');
      return;
    }

    if (pdfs.length === 0) {
      setErrorMessage('Please upload at least one PDF certificate file or a .zip archive.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('spreadsheet', spreadsheet);
      pdfs.forEach((file) => formData.append('pdfs', file));

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload and match files.');
      }

      onUploadSuccess(data.batch);
    } catch (err: unknown) {
      console.error('Upload Error:', err);
      const message = err instanceof Error ? err.message : 'Error processing files.';
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent = `Name,Email,Subject,CustomMessage\nJohn Doe,john@example.com,Certificate of Completion,Congratulations on graduating with honors!\nPriya Sharma,priya@example.com,Certificate of Distinction,Excellence award in AI development.\nAlex Rivers,alex@example.com,Certificate of Achievement,Top performance in Q3 workshop.`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_recipients.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            Upload Recipient Spreadsheet & PDF Certificates
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Upload your CSV/Excel recipient list and corresponding PDF certificates, a .zip archive, or a single multi-page PDF to auto-split.
          </p>
        </div>

        <button
          onClick={downloadSampleCsv}
          className="flex items-center space-x-2 px-3.5 py-2 text-xs font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-lg transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download Sample CSV</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Upload Error</p>
            <p className="text-xs text-rose-300/80 mt-0.5">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Two Drag & Drop Zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dropzone 1: Spreadsheet */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleSpreadsheetDrop}
          onClick={() => spreadsheetInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
            spreadsheet
              ? 'bg-indigo-950/20 border-indigo-500/50 hover:border-indigo-400'
              : 'bg-slate-900/40 border-slate-700/60 hover:border-indigo-500/50 hover:bg-slate-900/70'
          }`}
        >
          <input
            type="file"
            ref={spreadsheetInputRef}
            accept=".csv, .xlsx, .xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setSpreadsheet(e.target.files[0]);
                setErrorMessage(null);
              }
            }}
          />

          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
            <FileSpreadsheet className="w-7 h-7" />
          </div>

          <h3 className="text-sm font-semibold text-slate-200 text-center">
            {spreadsheet ? spreadsheet.name : '1. Upload CSV or Excel File'}
          </h3>
          <p className="text-xs text-slate-400 text-center mt-1">
            {spreadsheet
              ? `${(spreadsheet.size / 1024).toFixed(1)} KB — Click to change`
              : 'Drag & drop .csv or .xlsx file here, or click to browse'}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="text-[10px] font-medium px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">Columns: Name, Email</span>
            <span className="text-[10px] font-medium px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">Optional: Subject, CustomMessage</span>
          </div>

          {spreadsheet && (
            <div className="mt-4 flex items-center text-xs text-emerald-400 gap-1 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Spreadsheet Ready</span>
            </div>
          )}
        </div>

        {/* Dropzone 2: PDFs / ZIP */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handlePdfDrop}
          onClick={() => pdfInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
            pdfs.length > 0
              ? 'bg-indigo-950/20 border-indigo-500/50 hover:border-indigo-400'
              : 'bg-slate-900/40 border-slate-700/60 hover:border-indigo-500/50 hover:bg-slate-900/70'
          }`}
        >
          <input
            type="file"
            ref={pdfInputRef}
            multiple
            accept=".pdf, .zip"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setPdfs(Array.from(e.target.files));
                setErrorMessage(null);
              }
            }}
          />

          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
            <FileArchive className="w-7 h-7" />
          </div>

          <h3 className="text-sm font-semibold text-slate-200 text-center">
            {pdfs.length > 0
              ? `${pdfs.length} PDF / ZIP file(s) selected`
              : '2. Upload Certificate PDFs or .ZIP'}
          </h3>
          <p className="text-xs text-slate-400 text-center mt-1">
            {pdfs.length > 0
              ? `Files: ${pdfs.map((f) => f.name).slice(0, 2).join(', ')}${pdfs.length > 2 ? '...' : ''}`
              : 'Drag & drop individual .pdf files, a .zip archive, or a single multi-page PDF'}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="text-[10px] font-medium px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">e.g. John_Doe.pdf</span>
            <span className="text-[10px] font-medium px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">or certificates.zip</span>
            <span className="text-[10px] font-medium px-2 py-1 rounded bg-purple-900/40 text-purple-300 border border-purple-500/20">or single multi-page PDF</span>
          </div>

          {pdfs.length === 1 && pdfs[0].name.toLowerCase().endsWith('.pdf') && (
            <div className="mt-3 flex items-center text-xs text-purple-300 gap-1.5 font-medium bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/20">
              <Scissors className="w-3.5 h-3.5" />
              <span>Single PDF detected — will auto-split by page if multi-page</span>
            </div>
          )}

          {pdfs.length > 0 && (
            <div className="mt-3 flex items-center text-xs text-emerald-400 gap-1 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{pdfs.length} File(s) Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* Start Matching Action Bar */}
      <div className="flex justify-end pt-4">
        <button
          disabled={!spreadsheet || pdfs.length === 0 || isUploading}
          onClick={handleProcessUpload}
          className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm shadow-xl transition-all ${
            !spreadsheet || pdfs.length === 0 || isUploading
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 hover:scale-[1.02]'
          }`}
        >
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Running Matching Engine...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>Process & Auto-Match Recipients</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
