'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  Check,
  CheckCheck,
  AlertCircle,
  ArrowLeft,
  Search,
  Eye,
  Info,
  WifiOff,
} from 'lucide-react';
import { BatchSession } from '@/lib/types';

interface ReportStepProps {
  batch: BatchSession;
  onUpdateBatch: (batch: BatchSession) => void;
  onRestartNewBatch: () => void;
}

export const ReportStep: React.FC<ReportStepProps> = ({
  batch,
  onUpdateBatch,
  onRestartNewBatch,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'DELIVERED' | 'SEEN' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocalhost] = useState(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    }
    return false;
  });
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  // Stabilize callback ref to prevent useEffect re-render loops
  const onUpdateBatchRef = useRef(onUpdateBatch);
  useEffect(() => {
    onUpdateBatchRef.current = onUpdateBatch;
  }, [onUpdateBatch]);

  const batchIdRef = useRef(batch.id);
  useEffect(() => {
    batchIdRef.current = batch.id;
  }, [batch.id]);

  // Stable fetch function
  const fetchBatchStatus = useCallback(async () => {
    try {
      // 1. Fetch tracking events
      const eventsRes = await fetch(`/api/track/events?batchId=${batchIdRef.current}`);
      const eventsData = await eventsRes.json().catch(() => ({}));

      if (eventsData.success && Array.isArray(eventsData.events) && eventsData.events.length > 0) {
        const openedRecipientIds = new Set(
          eventsData.events.filter((e: { eventType: string }) => e.eventType === 'OPEN' || e.eventType === 'CLICK').map((e: { recipientId: string }) => e.recipientId)
        );

        if (openedRecipientIds.size > 0) {
          const currentBatch = batch;
          let hasUpdates = false;
          const updatedRecipients = currentBatch.recipients.map((r) => {
            if (openedRecipientIds.has(r.id) && r.sendStatus !== 'SEEN') {
              hasUpdates = true;
              const ev = eventsData.events.find((e: { recipientId: string }) => e.recipientId === r.id);
              return {
                ...r,
                sendStatus: 'SEEN' as const,
                seenAt: r.seenAt || ev?.timestamp || new Date().toISOString(),
                deliveredAt: r.deliveredAt || ev?.timestamp || new Date().toISOString(),
              };
            }
            return r;
          });

          if (hasUpdates) {
            const updatedBatch: BatchSession = {
              ...currentBatch,
              recipients: updatedRecipients,
              stats: {
                ...currentBatch.stats,
                seen: updatedRecipients.filter((r) => r.sendStatus === 'SEEN').length,
                delivered: updatedRecipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length,
              },
            };
            onUpdateBatchRef.current(updatedBatch);
          }
        }
      }

      // 2. Fetch server batch if available
      const res = await fetch(`/api/batch/${batchIdRef.current}`);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.batch) {
          onUpdateBatchRef.current(data.batch);
        }
      }
      setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Polling batch status failed:', err);
    }
  }, [batch]);

  // Live polling for status updates every 5 seconds — stabilized with refs
  useEffect(() => {
    const interval = setInterval(fetchBatchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchBatchStatus]);

  const stats = {
    total: batch.stats?.total || batch.recipients.length,
    sent: batch.recipients.filter((r) => r.sendStatus === 'SENT' || r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length,
    delivered: batch.recipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length,
    seen: batch.recipients.filter((r) => r.sendStatus === 'SEEN').length,
    failed: batch.recipients.filter((r) => r.sendStatus === 'FAILED').length,
    skipped: batch.recipients.filter((r) => r.sendStatus === 'SKIPPED').length,
  };

  const handleDownloadCsv = () => {
    window.open(`/api/reports/export/${batch.id}`, '_blank');
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchBatchStatus();
    // Brief delay so spinner is visible
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleSimulateOpen = async (recipientId: string) => {
    setSimulatingId(recipientId);
    const now = new Date().toISOString();

    // 1. Instant optimistic state update
    const updatedRecipients = batch.recipients.map((r) => {
      if (r.id === recipientId) {
        return {
          ...r,
          sendStatus: 'SEEN' as const,
          seenAt: r.seenAt || now,
          deliveredAt: r.deliveredAt || now,
        };
      }
      return r;
    });

    const updatedBatch: BatchSession = {
      ...batch,
      recipients: updatedRecipients,
      stats: {
        ...batch.stats,
        seen: updatedRecipients.filter((r) => r.sendStatus === 'SEEN').length,
        delivered: updatedRecipients.filter((r) => r.sendStatus === 'DELIVERED' || r.sendStatus === 'SEEN').length,
      },
    };

    onUpdateBatch(updatedBatch);
    setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    // 2. Trigger server tracking pixel endpoint in background
    try {
      await fetch(`/api/track/open?batchId=${batch.id}&recipientId=${recipientId}`).catch(() => {});
    } catch (err) {
      console.error('Failed to trigger open tracking pixel:', err);
    } finally {
      setSimulatingId(null);
    }
  };

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch('/api/batch/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: batch.id,
          action: 'START',
          onlyFailed: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const fetchRes = await fetch(`/api/batch/${batch.id}`);
        const fetchData = await fetchRes.json();
        if (fetchData.batch) {
          onUpdateBatch(fetchData.batch);
        }
      }
    } catch (err) {
      console.error('Failed to retry failed sends:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const filteredRecipients = batch.recipients.filter((item) => {
    const matchesSearch =
      item.recipient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.recipient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.matchedPdfName && item.matchedPdfName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'SEEN') return item.sendStatus === 'SEEN';
    if (statusFilter === 'DELIVERED') return item.sendStatus === 'DELIVERED';
    if (statusFilter === 'SENT') return item.sendStatus === 'SENT';
    if (statusFilter === 'FAILED') return item.sendStatus === 'FAILED';
    return true;
  });

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            Batch Delivery & Read-Receipt Report
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time status tracking for batch <span className="font-mono text-indigo-300">{batch.id}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {/* Manual Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>

          {stats.failed > 0 && (
            <button
              onClick={handleRetryFailed}
              disabled={isRetrying}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Retry Failed ({stats.failed})</span>
            </button>
          )}

          <button
            onClick={handleDownloadCsv}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV Report</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="glass-card p-4 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-400 font-medium">Total Processed</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{stats.total}</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-slate-700 bg-slate-900/50">
          <p className="text-xs text-slate-300 font-medium flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-slate-400" /> Sent
          </p>
          <p className="text-2xl font-bold text-slate-200 mt-1">{stats.sent}</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Delivered
          </p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{stats.delivered}</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-sky-500/20 bg-sky-500/5">
          <p className="text-xs text-sky-400 font-medium flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5 text-sky-400 fill-sky-400" /> Seen / Opened
          </p>
          <p className="text-2xl font-bold text-sky-300 mt-1">{stats.seen}</p>
        </div>

        <div className="glass-card p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
          <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </p>
          <p className="text-2xl font-bold text-rose-300 mt-1">{stats.failed}</p>
        </div>
      </div>

      {/* Localhost Warning Banner */}
      {isLocalhost && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200 flex items-start gap-3">
          <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Local Development Mode — Tracking Pixels Will Not Work Remotely</span>
            <p className="text-amber-200/80 mt-1 leading-relaxed">
              You are running on <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300">localhost:3000</code>. 
              The tracking pixel URL embedded in emails points to your local machine, which is unreachable from the recipient&apos;s device. 
              To test read-receipt tracking, use the <strong>&quot;Simulate Open&quot;</strong> button below, or deploy to a public URL.
            </p>
          </div>
        </div>
      )}

      {/* Open Tracking Notice Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 flex items-start gap-3">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="font-semibold text-slate-200">Open Tracking Notice:</span> Read receipt tracking (&quot;Seen&quot;) relies on a 1×1 image pixel embedded in HTML emails. Remote image loading is automatic in most webmail clients (Gmail, Yahoo), while some clients block images by default. Use the <strong>Simulate Open / Mark Seen</strong> button below to test pixel triggers.
        </div>
        {lastRefreshedAt && (
          <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">
            Last synced: {lastRefreshedAt}
          </span>
        )}
      </div>

      {/* Audit Log Table & Filters */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl space-y-4 p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All ({batch.recipients.length})
            </button>

            <button
              onClick={() => setStatusFilter('SEEN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                statusFilter === 'SEEN'
                  ? 'bg-sky-600 text-white shadow'
                  : 'bg-slate-900 text-sky-400 hover:bg-sky-500/10 border border-slate-800'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5 fill-sky-400 text-sky-400" />
              Seen ({stats.seen})
            </button>

            <button
              onClick={() => setStatusFilter('DELIVERED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                statusFilter === 'DELIVERED'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-900 text-emerald-400 hover:bg-emerald-500/10 border border-slate-800'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              Delivered ({stats.delivered})
            </button>

            <button
              onClick={() => setStatusFilter('SENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                statusFilter === 'SENT'
                  ? 'bg-slate-700 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Check className="w-3.5 h-3.5 text-slate-400" />
              Sent ({stats.sent - stats.delivered})
            </button>

            <button
              onClick={() => setStatusFilter('FAILED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                statusFilter === 'FAILED'
                  ? 'bg-rose-600 text-white shadow'
                  : 'bg-slate-900 text-rose-400 hover:bg-rose-500/10 border border-slate-800'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              Failed ({stats.failed})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search recipient or PDF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">Recipient</th>
                <th className="px-4 py-3 font-semibold">Certificate PDF</th>
                <th className="px-4 py-3 font-semibold">Status Stage</th>
                <th className="px-4 py-3 font-semibold">Timestamps</th>
                <th className="px-4 py-3 font-semibold">Actions / Test</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {filteredRecipients.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-100">{item.recipient.name}</div>
                    <div className="text-slate-400 text-[11px]">{item.recipient.email}</div>
                  </td>

                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {item.matchedPdfName || 'N/A'}
                  </td>

                  <td className="px-4 py-3">
                    {item.sendStatus === 'SEEN' && (
                      <span
                        title={`Seen at ${formatTimestamp(item.seenAt)}`}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 inline-flex items-center gap-1.5"
                      >
                        <CheckCheck className="w-3.5 h-3.5 fill-sky-400 text-sky-400" />
                        Seen
                      </span>
                    )}

                    {item.sendStatus === 'DELIVERED' && (
                      <span
                        title={`Delivered at ${formatTimestamp(item.deliveredAt)}`}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5"
                      >
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Delivered
                      </span>
                    )}

                    {item.sendStatus === 'SENT' && (
                      <span
                        title={`Sent at ${formatTimestamp(item.sentAt)}`}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 inline-flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-slate-400" />
                        Sent
                      </span>
                    )}

                    {item.sendStatus === 'FAILED' && (
                      <span
                        title={item.errorDetails || 'Delivery rejected or bounced'}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        Failed
                      </span>
                    )}

                    {item.sendStatus === 'SKIPPED' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900 text-slate-400 border border-slate-800">
                        Skipped
                      </span>
                    )}

                    {item.sendStatus === 'PENDING' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900 text-slate-500 border border-slate-800">
                        Pending
                      </span>
                    )}

                    {item.sendStatus === 'SENDING' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 inline-flex items-center gap-1.5 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Sending...
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-slate-400 text-[11px] space-y-0.5">
                    {item.sentAt && <div>Sent: {formatTimestamp(item.sentAt)}</div>}
                    {item.deliveredAt && <div className="text-emerald-400/90">Delivered: {formatTimestamp(item.deliveredAt)}</div>}
                    {item.seenAt && <div className="text-sky-400 font-medium">Seen: {formatTimestamp(item.seenAt)}</div>}
                    {!item.sentAt && !item.deliveredAt && !item.seenAt && <div>-</div>}
                  </td>

                  <td className="px-4 py-3 text-[11px]">
                    {item.sendStatus !== 'SEEN' && item.sendStatus !== 'SKIPPED' && item.sendStatus !== 'FAILED' && item.sendStatus !== 'PENDING' ? (
                      <button
                        onClick={() => handleSimulateOpen(item.id)}
                        disabled={simulatingId === item.id}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 transition-all flex items-center gap-1.5 disabled:opacity-60"
                        title="Simulate recipient opening email to trigger tracking pixel"
                      >
                        {simulatingId === item.id ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
                            <span>Marking...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 text-sky-400" />
                            <span>Mark as Seen</span>
                          </>
                        )}
                      </button>
                    ) : item.sendStatus === 'SEEN' ? (
                      <span className="text-sky-400/70 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Confirmed
                      </span>
                    ) : item.errorDetails ? (
                      <span className="text-rose-400 font-medium max-w-[200px] truncate block" title={item.errorDetails}>
                        {item.errorDetails}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRecipients.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            No recipients match the current filter.
          </div>
        )}
      </div>

      {/* Restart Button */}
      <div className="flex justify-start pt-2">
        <button
          onClick={onRestartNewBatch}
          className="flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Start New Mailing Batch</span>
        </button>
      </div>
    </div>
  );
};
