'use client';

import React from 'react';
import { History, Server } from 'lucide-react';

interface NavbarProps {
  onOpenSmtpModal: () => void;
  onOpenHistoryModal: () => void;
  hasSmtpConfig: boolean;
  onResetWizard: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSmtpModal,
  onOpenHistoryModal,
  hasSmtpConfig,
  onResetWizard,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 bg-slate-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center space-x-3">
          <div 
            onClick={onResetWizard}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 p-1 shadow-lg shadow-indigo-500/10 hover:scale-105 transition-transform duration-200 flex items-center justify-center overflow-hidden cursor-pointer"
          >
            <img src="/logo.png" alt="DiploMail Logo" className="w-full h-full object-contain rounded-lg" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span 
                onClick={onResetWizard}
                className="font-extrabold text-xl tracking-tight text-white cursor-pointer"
              >
                Diplo<span className="text-blue-500">Mail</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Automated Certificate & Diploma Delivery</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          {/* SMTP Status Button */}
          <button
            onClick={onOpenSmtpModal}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              hasSmtpConfig
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>{hasSmtpConfig ? 'SMTP Connected' : 'Configure Sender Email'}</span>
            <span className={`w-2 h-2 rounded-full ${hasSmtpConfig ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          </button>

          {/* History Button */}
          <button
            onClick={onOpenHistoryModal}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/60 border border-slate-700 hover:bg-slate-700/80 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Batches History</span>
          </button>
        </div>
      </div>
    </header>
  );
};
