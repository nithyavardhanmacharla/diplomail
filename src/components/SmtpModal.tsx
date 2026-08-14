'use client';

import React, { useState, useEffect } from 'react';
import { X, Server, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
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

  const isResend = host.includes('resend');
  const isBrevo = host.includes('brevo') || host.includes('sendinblue');
  const isSendGrid = host.includes('sendgrid');
  const isGmail = host.includes('gmail');
  const isHttpApi = isResend || isBrevo || (isSendGrid && Number(port) === 443);

  const applyPreset = (presetHost: string, presetPort: number, defaultUser = '', defaultFrom = '') => {
    setHost(presetHost);
    setPort(String(presetPort));
    setTestResult(null);
    if (defaultUser) {
      setUser(defaultUser);
    }
    if (defaultFrom) {
      setFromEmail(defaultFrom);
    }
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
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
            <h3 className="text-lg font-bold text-slate-100">SMTP &amp; Email Delivery Provider</h3>
            <p className="text-xs text-slate-400">Configure your sender credentials or free HTTP email API</p>
          </div>
        </div>

        {/* Presets Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Choose Provider Preset
            </label>
            <span className="text-[10px] text-emerald-400 font-medium">⚡ Port 443 = ISP Safe</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => applyPreset('api.resend.com', 443, 'onboarding@resend.dev', 'onboarding@resend.dev')}
              className={`p-2 rounded-xl text-left border transition-all ${
                isResend
                  ? 'bg-emerald-500/15 border-emerald-500/60 ring-2 ring-emerald-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-bold text-emerald-300">🚀 Resend</p>
              <p className="text-[10px] text-slate-400">3,000 / mo free</p>
            </button>

            <button
              onClick={() => applyPreset('api.brevo.com', 443)}
              className={`p-2 rounded-xl text-left border transition-all ${
                isBrevo
                  ? 'bg-blue-500/15 border-blue-500/60 ring-2 ring-blue-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-bold text-blue-300">⚡ Brevo</p>
              <p className="text-[10px] text-slate-400">300 / day free</p>
            </button>

            <button
              onClick={() => applyPreset('api.sendgrid.com', 443, 'apikey')}
              className={`p-2 rounded-xl text-left border transition-all ${
                isSendGrid
                  ? 'bg-sky-500/15 border-sky-500/60 ring-2 ring-sky-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-bold text-sky-300">📧 SendGrid</p>
              <p className="text-[10px] text-slate-400">100 / day free</p>
            </button>

            <button
              onClick={() => applyPreset('smtp.gmail.com', 465)}
              className={`p-2 rounded-xl text-left border transition-all ${
                isGmail
                  ? 'bg-indigo-500/15 border-indigo-500/60 ring-2 ring-indigo-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-bold text-indigo-300">⭐ Gmail</p>
              <p className="text-[10px] text-slate-400">Port 465 SSL</p>
            </button>
          </div>
        </div>

        {/* Dynamic Provider Guidance Cards */}
        {isResend && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Resend HTTPS API (Port 443 — Bypasses ISP Blocks)
              </span>
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] underline text-white hover:text-emerald-100 font-bold"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-emerald-300/80 leading-relaxed">
              * <strong>Sender Email rule:</strong> On Resend free tier, set "From Email" to <code className="bg-emerald-950/80 px-1 py-0.5 rounded text-emerald-200 font-bold">onboarding@resend.dev</code> (Resend blocks unverified @gmail.com domains).<br />
              * <strong>Want to send from your personal @gmail.com?</strong> Switch to <strong className="text-blue-300">⚡ Brevo</strong> above!
            </p>
          </div>
        )}

        {isBrevo && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5 text-blue-300">
                <CheckCircle2 className="w-4 h-4 text-blue-400" /> Brevo HTTP API (Port 443 — 300 free emails/day)
              </span>
              <a
                href="https://app.brevo.com/settings/keys/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] underline text-white hover:text-blue-100 font-bold"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-blue-300/80">
              1. Sign up at <a href="https://brevo.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">brevo.com</a>.<br />
              2. Go to <strong>SMTP &amp; API</strong> → Generate API Key (<code className="bg-blue-950/80 px-1 py-0.5 rounded text-blue-200">xkeysib-...</code>) &amp; paste below.
            </p>
          </div>
        )}

        {isSendGrid && (
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200 space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5 text-sky-300">
                <CheckCircle2 className="w-4 h-4 text-sky-400" /> SendGrid HTTP API (Port 443 — 100 free emails/day)
              </span>
              <a
                href="https://app.sendgrid.com/settings/api_keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] underline text-white hover:text-sky-100 font-bold"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-sky-300/80">
              1. Sign up at <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">sendgrid.com</a>.<br />
              2. Create API key with Full Access (<code className="bg-sky-950/80 px-1 py-0.5 rounded text-sky-200">SG....</code>) &amp; paste below.
            </p>
          </div>
        )}

        {isGmail && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Gmail SMTP (Port 465 SSL)
              </span>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] underline text-white hover:text-amber-100 font-bold"
              >
                <span>Google App Password</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-amber-300/80">
              * Requires a 16-character <strong>App Password</strong> (not your regular password).<br />
              * If you get a <strong>Connection timeout</strong>, your Wi-Fi/ISP blocks port 465. Switch to <strong>Resend</strong> or <strong>Brevo</strong> above to bypass it!
            </p>
          </div>
        )}

        {/* Server & Port Config */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              {isHttpApi ? 'API Endpoint' : 'SMTP Host'}
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={
                isResend
                  ? 'api.resend.com'
                  : isBrevo
                  ? 'api.brevo.com'
                  : isSendGrid
                  ? 'api.sendgrid.com'
                  : 'smtp.gmail.com'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="443"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Username & Password / API Key */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              {isResend || isBrevo
                ? 'Account Email (Optional)'
                : isSendGrid
                ? 'Username'
                : 'SMTP Username / Login'}
            </label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder={
                isResend
                  ? 'onboarding@resend.dev'
                  : isSendGrid
                  ? 'apikey'
                  : 'your.email@gmail.com'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              {isResend
                ? 'Resend API Key (re_...)'
                : isBrevo
                ? 'Brevo API Key (xkeysib-...)'
                : isSendGrid
                ? 'SendGrid API Key (SG....)'
                : 'Password / App Password'}
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={
                isResend
                  ? 're_123456789...'
                  : isBrevo
                  ? 'xkeysib-123456789...'
                  : isSendGrid
                  ? 'SG.123456789...'
                  : '••••••••••••••••'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Sender Name and Sender Email ID */}
        <div className="grid grid-cols-2 gap-3 bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-500/20">
          <div>
            <label className="text-xs font-semibold text-indigo-300 block mb-1">Sender Name ("From" Name)</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Certificate Coordinator"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-indigo-300 block mb-1">Sender Email ID ("From" Email)</label>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder={isResend ? 'onboarding@resend.dev' : 'certificates@domain.com'}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="col-span-2 text-[11px] text-slate-400">
            * Emails will be sent as: <strong className="text-indigo-300">"{fromName || 'Certificate Mailer'}" &lt;{fromEmail || user || 'sender@example.com'}&gt;</strong>
          </div>
        </div>

        {/* Throttling */}
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

        {/* Test Result Message */}
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
            <span className="leading-relaxed">{testResult.message}</span>
          </div>
        )}

        {/* Actions */}
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
            Save &amp; Apply
          </button>
        </div>
      </div>
    </div>
  );
};
