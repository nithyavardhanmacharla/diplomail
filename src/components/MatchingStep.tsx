'use client';

import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  ArrowRight,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  FileArchive,
} from 'lucide-react';
import { BatchSession, MatchStatus, PdfFileInfo } from '@/lib/types';

interface MatchingStepProps {
  batch: BatchSession;
  onUpdateBatch: (updatedBatch: BatchSession) => void;
  onProceedToCompose: () => void;
  onPreviewPdf: (pdf: PdfFileInfo) => void;
}

export const MatchingStep: React.FC<MatchingStepProps> = ({
  batch,
  onUpdateBatch,
  onProceedToCompose,
  onPreviewPdf,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCHED' | 'FUZZY' | 'UNMATCHED' | 'EXCLUDED'>('ALL');
  const [isSaving, setIsSaving] = useState(false);

  const recipients = batch.recipients || [];
  const pdfs = batch.pdfs || [];

  // Filtered Recipients
  const filteredRecipients = recipients.filter((item) => {
    const matchesSearch =
      item.recipient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.recipient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.matchedPdfName && item.matchedPdfName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'MATCHED') return item.status === 'MATCHED_EXACT';
    if (statusFilter === 'FUZZY') return item.status === 'MATCHED_FUZZY';
    if (statusFilter === 'UNMATCHED') return item.status === 'UNMATCHED';
    if (statusFilter === 'EXCLUDED') return item.status === 'EXCLUDED';

    return true;
  });

  const handleOverridePdf = async (recipientId: string, pdfId: string | null) => {
    let status: MatchStatus = 'MANUAL_OVERRIDE';
    let matchedPdfId = pdfId;

    if (!pdfId) {
      status = 'UNMATCHED';
      matchedPdfId = null;
    } else if (pdfId === 'EXCLUDE') {
      status = 'EXCLUDED';
      matchedPdfId = null;
    }

    const updatedRecipients = batch.recipients.map((r) => {
      if (r.id === recipientId) {
        const pdf = batch.pdfs.find((p) => p.id === matchedPdfId);
        return {
          ...r,
          matchedPdfId,
          matchedPdfName: pdf ? pdf.originalName : null,
          status,
          confidenceScore: matchedPdfId ? 1.0 : 0,
        };
      }
      return r;
    });

    const updatedBatch: BatchSession = {
      ...batch,
      recipients: updatedRecipients,
      stats: {
        ...batch.stats,
        matched: updatedRecipients.filter((r) => r.status === 'MATCHED_EXACT' || r.status === 'MATCHED_FUZZY' || r.status === 'MANUAL_OVERRIDE').length,
        unmatched: updatedRecipients.filter((r) => r.status === 'UNMATCHED').length,
        skipped: updatedRecipients.filter((r) => r.status === 'EXCLUDED').length,
      },
    };

    onUpdateBatch(updatedBatch);

    // Sync to server in background (non-blocking)
    fetch(`/api/batch/${batch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientUpdates: [{ recipientId, matchedPdfId, status }],
      }),
    }).catch((err) => console.warn('Background sync warning:', err));
  };

  const handleExcludeUnmatched = async () => {
    const updatedRecipients = batch.recipients.map((r) => {
      if (r.status === 'UNMATCHED') {
        return {
          ...r,
          status: 'EXCLUDED' as MatchStatus,
          matchedPdfId: null,
          matchedPdfName: null,
        };
      }
      return r;
    });

    const updatedBatch: BatchSession = {
      ...batch,
      recipients: updatedRecipients,
      stats: {
        ...batch.stats,
        matched: updatedRecipients.filter((r) => r.status === 'MATCHED_EXACT' || r.status === 'MATCHED_FUZZY' || r.status === 'MANUAL_OVERRIDE').length,
        unmatched: 0,
        skipped: updatedRecipients.filter((r) => r.status === 'EXCLUDED').length,
      },
    };

    onUpdateBatch(updatedBatch);

    const updates = recipients
      .filter((r) => r.status === 'UNMATCHED')
      .map((r) => ({ recipientId: r.id, matchedPdfId: null, status: 'EXCLUDED' as MatchStatus }));

    fetch(`/api/batch/${batch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientUpdates: updates }),
    }).catch((err) => console.warn('Background sync warning:', err));
  };

  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleDownloadAllZip = async () => {
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      let addedCount = 0;

      for (const item of recipients) {
        if (item.matchedPdfId && item.status !== 'EXCLUDED') {
          const pdfObj = pdfs.find((p) => p.id === item.matchedPdfId);
          if (pdfObj) {
            let buffer: ArrayBuffer | null = null;
            if (pdfObj.blobUrl) {
              try {
                const res = await fetch(pdfObj.blobUrl);
                if (res.ok) buffer = await res.arrayBuffer();
              } catch (e) {
                console.warn('Failed to fetch blobUrl for zip:', e);
              }
            }
            if (!buffer && pdfObj.contentBase64) {
              const bin = atob(pdfObj.contentBase64);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              buffer = bytes.buffer;
            }
            if (!buffer && pdfObj.id) {
              try {
                const res = await fetch(`/api/upload?pdfId=${encodeURIComponent(pdfObj.id)}`);
                if (res.ok) buffer = await res.arrayBuffer();
              } catch (e) {
                console.warn('Failed to fetch from api for zip:', e);
              }
            }

            if (buffer) {
              const filename = pdfObj.originalName || `${item.recipient.name.replace(/\s+/g, '_')}_Certificate.pdf`;
              zip.file(filename, buffer);
              addedCount++;
            }
          }
        }
      }

      if (addedCount === 0) {
        alert('No matched PDF certificates to export.');
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Matched_Certificates_${batch.name ? batch.name.replace(/[^a-zA-Z0-9_\-]/g, '_') : Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ZIP download error:', err);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const stats = {
    total: recipients.length,
    exact: recipients.filter((r) => r.status === 'MATCHED_EXACT').length,
    fuzzy: recipients.filter((r) => r.status === 'MATCHED_FUZZY').length,
    override: recipients.filter((r) => r.status === 'MANUAL_OVERRIDE').length,
    unmatched: recipients.filter((r) => r.status === 'UNMATCHED').length,
    excluded: recipients.filter((r) => r.status === 'EXCLUDED').length,
  };

  const matchedTotal = stats.exact + stats.fuzzy + stats.override;

  return (
    <div className="space-y-6">
      {/* Header & Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Total Recipients</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{stats.total}</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Matched Certificates
          </p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">
            {matchedTotal} <span className="text-xs font-normal text-emerald-400/70">({stats.exact} exact, {stats.fuzzy} fuzzy)</span>
          </p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
          <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Unmatched Entries
          </p>
          <p className="text-2xl font-bold text-rose-300 mt-1">{stats.unmatched}</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Excluded Entries
          </p>
          <p className="text-2xl font-bold text-slate-400 mt-1">{stats.excluded}</p>
        </div>
      </div>

      {/* Filter & Action Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass-card p-4 rounded-2xl border border-slate-800">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or PDF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full md:w-auto">
          {(['ALL', 'MATCHED', 'FUZZY', 'UNMATCHED', 'EXCLUDED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Quick Batch Actions */}
        {stats.unmatched > 0 && (
          <button
            onClick={handleExcludeUnmatched}
            disabled={isSaving}
            className="px-3.5 py-2 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl transition-colors shrink-0"
          >
            Exclude All Unmatched ({stats.unmatched})
          </button>
        )}
      </div>

      {/* Recipients Matching Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Recipient Name & Email</th>
                <th className="px-4 py-3.5 font-semibold">Matched Certificate PDF</th>
                <th className="px-4 py-3.5 font-semibold">Match Score</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No recipients matching current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecipients.map((item) => {
                  const isMatched = item.status === 'MATCHED_EXACT' || item.status === 'MATCHED_FUZZY' || item.status === 'MANUAL_OVERRIDE';
                  const matchedPdfObj = pdfs.find((p) => p.id === item.matchedPdfId);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        item.status === 'UNMATCHED'
                          ? 'bg-rose-500/5'
                          : item.status === 'EXCLUDED'
                          ? 'opacity-50 bg-slate-950/30'
                          : ''
                      }`}
                    >
                      {/* Recipient info */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-100">{item.recipient.name}</div>
                        <div className="text-slate-400 text-[11px]">{item.recipient.email}</div>
                      </td>

                      {/* Matched PDF Dropdown Selector */}
                      <td className="px-4 py-3.5">
                        <select
                          value={item.status === 'EXCLUDED' ? 'EXCLUDE' : item.matchedPdfId || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'EXCLUDE') {
                              handleOverridePdf(item.id, 'EXCLUDE');
                            } else {
                              handleOverridePdf(item.id, val || null);
                            }
                          }}
                          className={`w-full max-w-xs bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 ${
                            isMatched
                              ? 'border-slate-700'
                              : item.status === 'EXCLUDED'
                              ? 'border-slate-800 text-slate-500'
                              : 'border-rose-500/50 bg-rose-950/20 text-rose-300'
                          }`}
                        >
                          <option value="">-- No PDF Matched --</option>
                          {pdfs.map((pdf) => (
                            <option key={pdf.id} value={pdf.id}>
                              {pdf.originalName}
                            </option>
                          ))}
                          <option value="EXCLUDE">-- Exclude Recipient --</option>
                        </select>
                      </td>

                      {/* Confidence Score */}
                      <td className="px-4 py-3.5 font-medium">
                        {item.confidenceScore > 0 ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              item.confidenceScore >= 0.88
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : item.confidenceScore >= 0.50
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {Math.round(item.confidenceScore * 100)}% Match
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5">
                        {item.status === 'MATCHED_EXACT' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Exact Match
                          </span>
                        )}
                        {item.status === 'MATCHED_FUZZY' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Fuzzy Match
                          </span>
                        )}
                        {item.status === 'MANUAL_OVERRIDE' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 font-medium">
                            <SlidersHorizontal className="w-3.5 h-3.5" /> Overridden
                          </span>
                        )}
                        {item.status === 'UNMATCHED' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium">
                            <XCircle className="w-3.5 h-3.5" /> Unmatched
                          </span>
                        )}
                        {item.status === 'EXCLUDED' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                            Excluded
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-4 py-3.5 text-right">
                        {matchedPdfObj && (
                          <button
                            onClick={() => onPreviewPdf(matchedPdfObj)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                            title="Preview PDF Certificate"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proceed Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800/60">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadAllZip}
            disabled={isDownloadingZip || matchedTotal === 0}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            title="Download all individually split & named PDFs in a single ZIP file"
          >
            {isDownloadingZip ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Generating ZIP Archive...</span>
              </>
            ) : (
              <>
                <FileArchive className="w-3.5 h-3.5 text-indigo-400" />
                <span>Download All as .ZIP ({matchedTotal})</span>
              </>
            )}
          </button>

          <p className="text-xs text-slate-400 hidden md:block">
            Ready to dispatch? <strong className="text-slate-200">{matchedTotal}</strong> recipient(s) matched.
          </p>
        </div>

        <button
          onClick={onProceedToCompose}
          className="flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/25 hover:scale-[1.02] transition-all"
        >
          <span>Next: Compose Email</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
