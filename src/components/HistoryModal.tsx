'use client';

import React, { useState, useEffect } from 'react';
import { X, History, Trash2, ArrowRight, Clock } from 'lucide-react';
import { BatchSession } from '@/lib/types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBatch: (batch: BatchSession) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectBatch,
}) => {
  const [batches, setBatches] = useState<BatchSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      fetch('/api/batches')
        .then((res) => res.json())
        .then((data) => {
          if (isMounted) {
            if (data.batches) setBatches(data.batches);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.error('Failed to load batch history:', err);
          if (isMounted) setIsLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeleteBatch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/batch/${id}`, { method: 'DELETE' });
      setBatches((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error('Failed to delete batch:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Batches & Session History</h3>
            <p className="text-xs text-slate-400">Review past certificate mailings or resume draft sessions</p>
          </div>
        </div>

        <div className="divide-y divide-slate-800/60 max-h-[380px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading history...</div>
          ) : batches.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No saved batch sessions found.</div>
          ) : (
            batches.map((b) => (
              <div
                key={b.id}
                onClick={() => {
                  onSelectBatch(b);
                  onClose();
                }}
                className="py-3 px-3 hover:bg-slate-900/60 rounded-xl cursor-pointer transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-200 group-hover:text-indigo-400 transition-colors">
                    {b.name}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(b.createdAt).toLocaleDateString()}
                    </span>
                    <span>
                      Recipients: <strong className="text-slate-300">{b.stats?.total || b.recipients?.length || 0}</strong>
                    </span>
                    <span>
                      Sent: <strong className="text-emerald-400">{b.stats?.sent || 0}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {b.status}
                  </span>
                  <button
                    onClick={(e) => handleDeleteBatch(b.id, e)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
