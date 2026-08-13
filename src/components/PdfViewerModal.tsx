'use client';

import React from 'react';
import { X, FileText } from 'lucide-react';
import { PdfFileInfo } from '@/lib/types';

interface PdfViewerModalProps {
  pdf: PdfFileInfo | null;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({ pdf, onClose }) => {
  if (!pdf) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-4xl h-[85vh] rounded-2xl border border-slate-800 p-4 space-y-3 shadow-2xl relative flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100">{pdf.originalName}</h3>
            <span className="text-[10px] text-slate-400">({(pdf.size / 1024).toFixed(1)} KB)</span>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 w-full bg-slate-900 rounded-xl overflow-hidden">
          {pdf.url ? (
            <iframe src={`/api/upload?pdfPath=${encodeURIComponent(pdf.url)}`} className="w-full h-full border-none" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
              PDF preview not supported for base64 buffer in inline mode.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
