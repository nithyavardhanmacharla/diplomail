'use client';

import React, { useState, useEffect } from 'react';
import { X, Server, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { SmtpConfig } from '@/lib/types';

interface SmtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  smtpConfig: Partial<SmtpConfig>;
  onSaveConfig: (config: Partial<SmtpConfig>) => void;
}

export const SmtpModal: React.FC<SmtpModalProps> = ({
  isOpen,
  onClose,
  smtpConfig,
  onSaveConfig,
}) => {
  const [host, setHost] = useState(smtpConfig.host || 'smtp.gmail.com');
  const [port, setPort] = useState(String(smtpConfig.port || 465));
  const [user, setUser] = useState(smtpConfig.user || '');
  const [pass, setPass] = useState(smtpConfig.pass || '');
  const [fromName, setFromName] = useState(smtpConfig.fromName || 'Certificate Mailer');
  const [fromEmail, setFromEmail] = useState(smtpConfig.fromEmail || '');
  const [throttleDelayMs, setThrottleDelayMs] = useState(String(smtpConfig.throttleDelayMs || 1000));

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (smtpConfig) {
      if (smtpConfig.host) setHost(smtpConfig.host);
      if (smtpConfig.port) setPort(String(smtpConfig.port));
      if (smtpConfig.user) setUser(smtpConfig.user);
      if (smtpConfig.pass) setPass(smtpConfig.pass);
      if (smtpConfig.fromName) setFromName(smtpConfig.fromName);
      if (smtpConfig.fromEmail) setFromEmail(smtpConfig.fromEmail);
      if (smtpConfig.throttleDelayMs) setThrottleDelayMs(String(smtpConfig.throttleDelayMs));
    }
  }, [smtpConfig]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const configPayload = {
        host,
        port: Number(port),
        secure: Number(port) === 465,
        user,
        pass,
        fromName,
        fromEmail: fromEmail || user,
        throttleDelayMs: Number(throttleDelayMs),
      };

      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configPayload),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Connection test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const configPayload: Partial<SmtpConfig> = {
      host,
      port: Number(port),
      secure: Number(port) === 465,
      user,
      pass,
      fromName,
      fromEmail: fromEmail || user,
      throttleDelayMs: Number(throttleDelayMs),
    };

    try {
      await fetch('/api/smtp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configPayload),
      });
    } catch (err) {
      console.error('Failed to save SMTP config to server:', err);
    }

    onSaveConfig(configPayload);
    onClose();
  };

  const applyPreset = (presetHost: string, presetPort: number) => {
    setHost(presetHost);
    setPort(String(presetPort));
  };

  const isResend = host.includes('resend');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">SMTP Provider & Sender Mail ID</h3>
            <p className="text-xs text-slate-400">Configure your specific sender email ID & server credentials</p>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Quick Provider Presets
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyPreset('smtp.gmail.com', 465)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                host === 'smtp.gmail.com' && Number(port) === 465
                  ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/60 font-bold ring-2 ring-indigo-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              ⭐ Gmail (Port 465 SSL)
            </button>
            <button
              onClick={() => applyPreset('smtp.gmail.com', 587)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                host === 'smtp.gmail.com' && Number(port) === 587
                  ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/60 font-bold ring-2 ring-indigo-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              Gmail (Port 587 TLS)
            </button>
            <button
              onClick={() => applyPreset('api.resend.com', 443)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isResend
                  ? 'bg-emerald-600/40 text-emerald-200 border border-emerald-500/60 font-bold ring-2 ring-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              🚀 Resend (HTTPS Port 443 — ISP Bypass)
            </button>
            <button
              onClick={() => applyPreset('smtp.sendgrid.net', 587)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                host === 'smtp.sendgrid.net'
                  ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/60 font-bold ring-2 ring-indigo-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              SendGrid
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-300 block mb-1">SMTP Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="smtp.gmail.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="587"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">SMTP Username / Login</label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="your.email@gmail.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Password / App Password</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Specific Sender ID Configuration */}
        <div className="grid grid-cols-2 gap-3 bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-500/20">
          <div>
            <label className="text-xs font-semibold text-indigo-300 block mb-1">Sender Name ("From" Name)</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Acme Academy"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-indigo-300 block mb-1">Sender Email ID ("From" Email)</label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="certificates@domain.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="col-span-2 text-[11px] text-slate-400">
            * Emails will be sent as: <strong className="text-indigo-300">"{fromName || 'Certificate Mailer'}" &lt;{fromEmail || user || 'sender@example.com'}&gt;</strong>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">Throttling Delay between emails (ms)</label>
          <input
            type="number"
            value={throttleDelayMs}
            onChange={(e) => setThrottleDelayMs(e.target.value)}
            placeholder="1000"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
              testResult.success
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
          </button>

          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
