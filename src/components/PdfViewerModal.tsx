'use client';

import React, { useState } from 'react';
import { X, FileText, ExternalLink, Download, AlertCircle } from 'lucide-react';
import { PdfFileInfo } from '@/lib/types';

interface PdfViewerModalProps {
  pdf: PdfFileInfo | null;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({ pdf, onClose }) => {
  const [loadError, setLoadError] = useState(false);

  if (!pdf) return null;

  // Determine the best source URL for the PDF
  const pdfUrl = pdf.blobUrl
    ? pdf.blobUrl
    : pdf.id
    ? `/api/upload?pdfId=${encodeURIComponent(pdf.id)}`
    : pdf.url
    ? `/api/upload?pdfPath=${encodeURIComponent(pdf.url)}`
    : pdf.contentBase64
    ? `data:application/pdf;base64,${pdf.contentBase64}`
    : '';

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = pdf.originalName || pdf.filename || 'certificate.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel w-full max-w-4xl h-[88vh] rounded-2xl border border-slate-800 p-4 space-y-3 shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-bold text-slate-100 truncate">
                {pdf.originalName || pdf.filename}
              </h3>
              <span className="text-[11px] text-slate-400">
                {(pdf.size / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {pdfUrl && (
              <>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 px-2.5 py-1.5 text-xs text-slate-300 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/60"
                  title="Open in new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open in Tab</span>
                </a>

                <button
                  onClick={handleDownload}
                  className="flex items-center space-x-1 px-2.5 py-1.5 text-xs text-slate-300 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/60"
                  title="Download PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 w-full bg-slate-900 rounded-xl overflow-hidden relative border border-slate-800/80">
          {pdfUrl && !loadError ? (
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full h-full"
              onError={() => setLoadError(true)}
            >
              <iframe
                src={pdfUrl}
                className="w-full h-full border-none"
                title="Certificate Preview"
              />
            </object>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <p className="text-sm font-medium text-slate-300">
                Direct inline preview could not be loaded in this browser window.
              </p>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-lg"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open PDF in New Tab</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
