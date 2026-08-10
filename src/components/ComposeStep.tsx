'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Sparkles, Server, Eye, Save, Code, FileText, ArrowRight, Check } from 'lucide-react';
import { BatchSession, EmailTemplate, SmtpConfig } from '@/lib/types';
import { interpolateTemplate, DEFAULT_EMAIL_TEMPLATES } from '@/lib/template';

interface ComposeStepProps {
  batch: BatchSession;
  smtpConfig: Partial<SmtpConfig>;
  onUpdateBatch: (batch: BatchSession) => void;
  onOpenSmtpModal: () => void;
  onProceedToSend: () => void;
}

export const ComposeStep: React.FC<ComposeStepProps> = ({
  batch,
  smtpConfig,
  onUpdateBatch,
  onOpenSmtpModal,
  onProceedToSend,
}) => {
  const [templateName, setTemplateName] = useState(batch.template?.name || 'Custom Certificate Email');
  const [subject, setSubject] = useState(batch.template?.subject || 'Your Certificate of Completion: {{name}}');
  const [bodyHtml, setBodyHtml] = useState(batch.template?.bodyHtml || DEFAULT_EMAIL_TEMPLATES[0].bodyHtml);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [selectedRecipientIndex, setSelectedRecipientIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const matchedRecipients = batch.recipients.filter(
    (r) => r.status === 'MATCHED_EXACT' || r.status === 'MATCHED_FUZZY' || r.status === 'MANUAL_OVERRIDE'
  );

  const currentRecipient = matchedRecipients[selectedRecipientIndex] || batch.recipients[0];

  const handleInsertTag = (tag: string) => {
    setBodyHtml((prev) => prev + ` ${tag} `);
  };

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    try {
      const templateObj: EmailTemplate = {
        id: batch.template?.id || `tmpl_${Date.now()}`,
        name: templateName,
        subject,
        bodyHtml,
        bodyText: bodyHtml.replace(/<[^>]*>/g, ''), // strip basic html tags for plain text fallback
      };

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateObj),
      });

      const data = await res.json();
      if (data.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);

        // Update batch template
        const updateRes = await fetch(`/api/batch/${batch.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: templateObj }),
        });

        const updateData = await updateRes.json();
        if (updateData.success && updateData.batch) {
          onUpdateBatch(updateData.batch);
        }
      }
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProceed = async () => {
    await handleSaveTemplate();
    onProceedToSend();
  };

  const previewSubject = currentRecipient
    ? interpolateTemplate(subject, currentRecipient.recipient, currentRecipient.matchedPdfName)
    : subject;

  const previewBody = currentRecipient
    ? interpolateTemplate(bodyHtml, currentRecipient.recipient, currentRecipient.matchedPdfName)
    : bodyHtml;

  const isSmtpConfigured = Boolean(smtpConfig.user && smtpConfig.pass);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" />
            Compose Certificate Email Template
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Customize subject, email body, and dynamic variables. Renders a live preview for each recipient.
          </p>
        </div>

        <button
          onClick={onOpenSmtpModal}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
            isSmtpConfigured
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 animate-pulse'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>{isSmtpConfigured ? 'SMTP Settings Configured' : 'Configure SMTP Settings'}</span>
        </button>
      </div>

      {/* Editor & Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template Form & Variables (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            {/* Template Name & Presets */}
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template Name..."
                className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 w-full"
              />

              <button
                onClick={handleSaveTemplate}
                disabled={isSaving}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors shrink-0"
              >
                {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savedSuccess ? 'Saved!' : 'Save Template'}</span>
              </button>
            </div>

            {/* Variable Pills Bar */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Insert Dynamic Variables
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['{{name}}', '{{email}}', '{{filename}}', '{{customMessage}}', '{{subject}}'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleInsertTag(tag)}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 hover:bg-indigo-900/80 transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Email Subject Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Email Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Your Certificate of Completion: {{name}}"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* HTML Body Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-indigo-400" /> Email HTML / Body Content
                </label>
                <span className="text-[10px] text-slate-500">Supports HTML tags & CSS</span>
              </div>
              <textarea
                rows={12}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live Recipient Email Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-400" /> Live Interpolated Preview
              </h3>

              {/* Recipient Dropdown Switcher */}
              {matchedRecipients.length > 0 && (
                <select
                  value={selectedRecipientIndex}
                  onChange={(e) => setSelectedRecipientIndex(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 max-w-[160px] truncate"
                >
                  {matchedRecipients.map((r, idx) => (
                    <option key={r.id} value={idx}>
                      {r.recipient.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Simulated Email Inbox Window */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
              {/* Inbox Header */}
              <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400">
                  <strong className="text-slate-300">From:</strong> {smtpConfig.fromName || 'Certificate Mailer'}{' '}
                  &lt;{smtpConfig.fromEmail || smtpConfig.user || 'sender@example.com'}&gt;
                </div>
                <div className="text-[11px] text-slate-400">
                  <strong className="text-slate-300">To:</strong> {currentRecipient?.recipient.email || 'recipient@example.com'}
                </div>
                <div className="text-xs font-semibold text-indigo-300 pt-1">Subject: {previewSubject}</div>
                {currentRecipient?.matchedPdfName && (
                  <div className="text-[11px] text-emerald-400 font-medium pt-1 flex items-center gap-1">
                    📎 Attachment: {currentRecipient.matchedPdfName}
                  </div>
                )}
              </div>

              {/* Email Content Render */}
              <div className="p-4 bg-white text-slate-900 max-h-[380px] overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: previewBody }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4">
        <p className="text-xs text-slate-400">
          Template saved. Ensure your SMTP configuration is verified before mass sending.
        </p>

        <button
          onClick={handleProceed}
          className="flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/25 hover:scale-[1.02] transition-all"
        >
          <span>Next: Review & Send</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
