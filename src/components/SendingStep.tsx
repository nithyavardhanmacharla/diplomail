'use client';

import React, { useState, useRef } from 'react';
import { Send, Pause, Play, AlertCircle, RefreshCw, ArrowRight, Clock, Server, AlertTriangle, Check, CheckCheck } from 'lucide-react';
import { BatchSession, SmtpConfig } from '@/lib/types';

interface SendingStepProps {
  batch: BatchSession;
  smtpConfig: Partial<SmtpConfig>;
  onUpdateBatch: (batch: BatchSession) => void;
  onProceedToReport: () => void;
  onOpenSmtpModal: () => void;
}

export const SendingStep: React.FC<SendingStepProps> = ({
  batch,
  smtpConfig,
  onUpdateBatch,
  onProceedToReport,
  onOpenSmtpModal,
}) => {
  const [isConfirmed, setIsConfirmed] = useState(batch.status === 'SENDING' || batch.status === 'COMPLETED');
  const [isSending, setIsSending] = useState(batch.status === 'SENDING');
  const [isPaused, setIsPaused] = useState(batch.status === 'PAUSED');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLoopingRef = useRef(false);

  const matchedRecipients = batch.recipients.filter(
    (r) => r.status === 'MATCHED_EXACT' || r.status === 'MATCHED_FUZZY' || r.status === 'MANUAL_OVERRIDE'
  );

  const totalToSend = matchedRecipients.length;
  const sentCount = batch.stats?.sent || 0;
  const failedCount = batch.stats?.failed || 0;
  const percentComplete = totalToSend > 0 ? Math.round(((sentCount + failedCount) / totalToSend) * 100) : 0;

  const runChunkLoop = async (onlyFailed = false) => {
    if (isLoopingRef.current) return;
    isLoopingRef.current = true;

    setErrorMessage(null);

    if (!smtpConfig.user && !smtpConfig.pass) {
      onOpenSmtpModal();
      setErrorMessage('SMTP Credentials required. Please configure your sender email in SMTP settings.');
      isLoopingRef.current = false;
      return;
    }

    setIsConfirmed(true);
    setIsSending(true);
    setIsPaused(false);

    try {
      let done = false;
      while (!done && isLoopingRef.current) {
        const res = await fetch('/api/batch/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: batch.id,
            action: 'START',
            smtpConfig,
            onlyFailed,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to dispatch email batch.');
        }

        if (data.batch) {
          onUpdateBatch(data.batch);
        }

        if (data.done || data.batch?.status === 'COMPLETED' || data.batch?.status === 'PAUSED') {
          done = true;
          if (data.batch?.status === 'PAUSED') {
            setIsPaused(true);
          }
          break;
        }
      }
    } catch (err: unknown) {
      console.error('Failed dispatch chunk:', err);
      const message = err instanceof Error ? err.message : 'Error dispatching emails.';
      setErrorMessage(message);
    } finally {
      setIsSending(false);
      isLoopingRef.current = false;
    }
  };

  const handlePauseSending = async () => {
    isLoopingRef.current = false;
    setIsSending(false);
    setIsPaused(true);

    try {
      const res = await fetch('/api/batch/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: batch.id, action: 'PAUSE' }),
      });
      const data = await res.json();
      if (data.batch) onUpdateBatch(data.batch);
    } catch (err) {
      console.error('Failed to pause sending:', err);
    }
  };

  const handleResumeSending = () => {
    runChunkLoop(false);
  };

  const delaySeconds = (Number(smtpConfig.throttleDelayMs || 1000) / 1000).toFixed(1);
  const estTotalTimeSec = Math.round(totalToSend * Number(delaySeconds));

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3 max-w-3xl mx-auto">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Dispatch Error</p>
            <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={onOpenSmtpModal}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 shrink-0"
          >
            Configure Sender Email
          </button>
        </div>
      )}

      {/* Confirmation & Overview Screen before start */}
      {!isConfirmed && batch.status !== 'SENDING' && batch.status !== 'COMPLETED' ? (
        <div className="glass-panel p-8 rounded-2xl border border-slate-800 space-y-6 max-w-3xl mx-auto">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <Send className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-100">Ready to Start Mass Certificate Delivery?</h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Please review the batch parameters below before confirming delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-400 font-medium">Recipients to Mail</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">{totalToSend}</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-400 font-medium">Throttling Delay</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">{delaySeconds}s / mail</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-400 font-medium">Est. Completion</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">~{estTotalTimeSec}s</p>
            </div>
          </div>

          <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 text-xs text-indigo-300 flex items-start gap-3">
            <Clock className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">Rate Limiting Protected</p>
              <p className="text-slate-400 mt-0.5">
                Emails will be dispatched with a {delaySeconds}s delay between messages from{' '}
                <strong className="text-indigo-300">{smtpConfig.fromEmail || smtpConfig.user || 'configured sender'}</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {!smtpConfig.user && !smtpConfig.pass && (
              <button
                onClick={onOpenSmtpModal}
                className="flex items-center space-x-2 px-6 py-3.5 rounded-xl font-semibold text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                <Server className="w-4 h-4" />
                <span>Configure Sender Email First</span>
              </button>
            )}

            <button
              onClick={() => runChunkLoop(false)}
              disabled={isSending || totalToSend === 0}
              className={`flex items-center space-x-2 px-8 py-3.5 rounded-xl font-bold text-sm shadow-xl transition-all ${
                totalToSend === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 hover:scale-[1.02]'
              }`}
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Starting Dispatch...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Confirm & Start Batch Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Real-time Progress & Dispatch Dashboard */
        <div className="space-y-6">
          {/* Progress Header & Stats */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <RefreshCw className={`w-5 h-5 text-indigo-400 ${isSending ? 'animate-spin' : ''}`} />
                  Batch Delivery Progress ({sentCount + failedCount} / {totalToSend})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {batch.status === 'COMPLETED'
                    ? 'All emails processed!'
                    : isPaused
                    ? 'Batch dispatch paused'
                    : 'Dispatching emails with rate-limiting throttling...'}
                </p>
              </div>

              {/* Pause / Resume / Retry / SMTP Controls */}
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                {isSending && (
                  <button
                    onClick={handlePauseSending}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </button>
                )}

                {isPaused && (
                  <button
                    onClick={handleResumeSending}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span>Resume</span>
                  </button>
                )}

                {failedCount > 0 && !isSending && (
                  <>
                    <button
                      onClick={onOpenSmtpModal}
                      className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                    >
                      <Server className="w-4 h-4 text-amber-400" />
                      <span>Reconfigure SMTP (Port 465)</span>
                    </button>

                    <button
                      onClick={() => runChunkLoop(true)}
                      className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 text-rose-400" />
                      <span>Retry Failed ({failedCount})</span>
                    </button>
                  </>
                )}

                {(batch.status === 'COMPLETED' || percentComplete === 100) && (
                  <button
                    onClick={onProceedToReport}
                    className="flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow transition-all"
                  >
                    <span>View Sent Report</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {failedCount > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-300">
                    SMTP Connection Failed ({failedCount} email(s) failed)
                  </p>
                  <p className="text-amber-200/90 text-[11px] leading-relaxed">
                    <strong>1. Switch to Port 465 (SSL):</strong> Port 587 (TLS/STARTTLS) is blocked by many ISPs and causes <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">ETIMEDOUT</code>. Click <strong>Configure Sender Email</strong> above and select <strong>⭐ Gmail (Port 465 SSL)</strong>.<br />
                    <strong>2. Use a Gmail App Password:</strong> Use a 16-character App Password from <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline text-indigo-300">myaccount.google.com/apppasswords</a> instead of your main account password.
                  </p>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-indigo-400">{percentComplete}% Complete</span>
                <span className="text-slate-400">
                  Sent/Delivered: <strong className="text-emerald-400">{sentCount}</strong> | Failed: <strong className="text-rose-400">{failedCount}</strong>
                </span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>
          </div>

          {/* Live Recipients Feed */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 font-semibold text-xs text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Live Queue Status</span>
              <span className="text-[11px] text-slate-400 normal-case">✓ Sent | ✓✓ Delivered | ✓✓ Blue Seen</span>
            </div>

            <div className="divide-y divide-slate-800/60 max-h-[420px] overflow-y-auto">
              {matchedRecipients.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-200">{item.recipient.name}</span>
                    <span className="text-slate-400 ml-2">({item.recipient.email})</span>
                    <div className="text-[11px] text-slate-500 mt-0.5">PDF: {item.matchedPdfName}</div>
                  </div>

                  <div>
                    {item.sendStatus === 'SEEN' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5 fill-sky-400 text-sky-400" /> Seen
                      </span>
                    )}
                    {item.sendStatus === 'DELIVERED' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Delivered
                      </span>
                    )}
                    {item.sendStatus === 'SENT' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-slate-400" /> Sent
                      </span>
                    )}
                    {item.sendStatus === 'FAILED' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Failed: {item.errorDetails || 'Error'}
                      </span>
                    )}
                    {item.sendStatus === 'SENDING' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Dispatching...
                      </span>
                    )}
                    {item.sendStatus === 'PENDING' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900 text-slate-400 border border-slate-800">
                        Queued
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
