'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Mail,
  Sparkles,
  Server,
  Eye,
  Save,
  Code,
  FileText,
  ArrowRight,
  Check,
  Bold,
  Italic,
  Heading,
  Link,
  Minus,
  List,
  ListOrdered,
  Type,
  HelpCircle,
  ChevronDown,
  Palette,
  Info,
  Maximize2,
  Minimize2,
  Wand2,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { BatchSession, EmailTemplate, SmtpConfig } from '@/lib/types';
import { interpolateTemplate, DEFAULT_EMAIL_TEMPLATES } from '@/lib/template';

interface ComposeStepProps {
  batch: BatchSession;
  smtpConfig: Partial<SmtpConfig>;
  onUpdateBatch: (batch: BatchSession) => void;
  onOpenSmtpModal: () => void;
  onProceedToSend: () => void;
}

// Variable definitions with descriptions
const TEMPLATE_VARIABLES = [
  { tag: '{{name}}', label: 'Name', description: 'Recipient\'s full name from CSV' },
  { tag: '{{email}}', label: 'Email', description: 'Recipient\'s email address' },
  { tag: '{{filename}}', label: 'Filename', description: 'Matched PDF certificate filename' },
  { tag: '{{customMessage}}', label: 'Custom Msg', description: 'Per-recipient custom message from CSV' },
  { tag: '{{subject}}', label: 'Subject', description: 'Per-recipient subject override from CSV' },
  { tag: '{{trackingUrl}}', label: 'Track URL', description: 'Auto-generated certificate view & tracking link' },
];

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
  const [selectedRecipientIndex, setSelectedRecipientIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showVariableHelp, setShowVariableHelp] = useState(false);
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved templates on mount
  useEffect(() => {
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) setSavedTemplates(data.templates);
      })
      .catch((err) => console.error('Failed to load templates:', err));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTemplateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matchedRecipients = batch.recipients.filter(
    (r) => r.status === 'MATCHED_EXACT' || r.status === 'MATCHED_FUZZY' || r.status === 'MANUAL_OVERRIDE'
  );

  const currentRecipient = matchedRecipients[selectedRecipientIndex] || batch.recipients[0];

  // Cursor-aware variable/text insertion
  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBodyHtml((prev) => prev + text);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = bodyHtml.substring(0, start);
    const after = bodyHtml.substring(end);
    const newValue = before + text + after;
    setBodyHtml(newValue);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    });
  }, [bodyHtml]);

  const handleInsertTag = (tag: string) => {
    insertAtCursor(tag);
  };

  // Formatting toolbar actions
  const handleFormat = (format: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = bodyHtml.substring(start, end);

    let insertion = '';
    switch (format) {
      case 'bold':
        insertion = `<strong>${selectedText || 'bold text'}</strong>`;
        break;
      case 'italic':
        insertion = `<em>${selectedText || 'italic text'}</em>`;
        break;
      case 'heading':
        insertion = `<h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin: 16px 0 8px 0;">${selectedText || 'Heading'}</h2>`;
        break;
      case 'link':
        insertion = `<a href="https://example.com" style="color: #4f46e5; text-decoration: underline;" target="_blank">${selectedText || 'Link Text'}</a>`;
        break;
      case 'hr':
        insertion = `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`;
        break;
      case 'ul':
        insertion = `<ul style="margin: 12px 0; padding-left: 20px;"><li>${selectedText || 'List item'}</li></ul>`;
        break;
      case 'ol':
        insertion = `<ol style="margin: 12px 0; padding-left: 20px;"><li>${selectedText || 'List item'}</li></ol>`;
        break;
      case 'paragraph':
        insertion = `<p style="margin: 12px 0; font-size: 15px; line-height: 1.6;">${selectedText || 'Paragraph text'}</p>`;
        break;
      default:
        return;
    }

    const before = bodyHtml.substring(0, start);
    const after = bodyHtml.substring(end);
    const newValue = before + insertion + after;
    setBodyHtml(newValue);

    requestAnimationFrame(() => {
      textarea.selectionStart = start;
      textarea.selectionEnd = start + insertion.length;
      textarea.focus();
    });
  };

  const handleSelectTemplate = (template: EmailTemplate) => {
    setTemplateName(template.name);
    setSubject(template.subject);
    setBodyHtml(template.bodyHtml);
    setShowTemplateDropdown(false);
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

        if (data.templates) setSavedTemplates(data.templates);

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

  const rawPreviewBody = currentRecipient
    ? interpolateTemplate(bodyHtml, currentRecipient.recipient, currentRecipient.matchedPdfName)
    : bodyHtml;

  // Security: Sanitize interpolated HTML to prevent XSS from CSV data
  const previewBody = useMemo(() => DOMPurify.sanitize(rawPreviewBody, {
    ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'target', 'rel', 'width', 'height', 'colspan', 'rowspan'],
  }), [rawPreviewBody]);

  const isSmtpConfigured = Boolean(smtpConfig.user && smtpConfig.pass);

  // Approximate email size
  const emailSizeKb = useMemo(() => {
    const totalChars = (subject.length + bodyHtml.length) * 2; // rough UTF-8 overhead
    return (totalChars / 1024).toFixed(1);
  }, [subject, bodyHtml]);

  // All available templates (defaults + saved)
  const allTemplates = useMemo(() => {
    const defaultIds = DEFAULT_EMAIL_TEMPLATES.map((t) => t.id);
    const userTemplates = savedTemplates.filter((t) => !defaultIds.includes(t.id));
    return [...DEFAULT_EMAIL_TEMPLATES, ...userTemplates];
  }, [savedTemplates]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" />
            Compose Certificate Email
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Choose a template, customize your email, and preview it for each recipient.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Email Size Indicator */}
          <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
            ~{emailSizeKb} KB
          </span>

          <button
            onClick={onOpenSmtpModal}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
              isSmtpConfigured
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 animate-pulse'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>{isSmtpConfigured ? 'SMTP Configured ✓' : 'Configure SMTP'}</span>
          </button>
        </div>
      </div>

      {/* Template Preset Selector */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Wand2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 shrink-0">Template:</span>

            {/* Template Dropdown */}
            <div className="relative flex-1 max-w-md" ref={dropdownRef}>
              <button
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="w-full flex items-center justify-between gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 hover:border-indigo-500/50 transition-colors"
              >
                <span className="truncate font-medium">{templateName}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showTemplateDropdown && (
                <div className="absolute top-full left-0 mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden compose-dropdown-enter">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Choose a Template</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {allTemplates.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => handleSelectTemplate(tmpl)}
                        className={`w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-800 transition-colors flex items-center gap-2 ${
                          templateName === tmpl.name ? 'bg-indigo-500/10 text-indigo-300' : 'text-slate-300'
                        }`}
                      >
                        {tmpl.isDefault && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
                        {!tmpl.isDefault && <FileText className="w-3 h-3 text-slate-500 shrink-0" />}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{tmpl.name}</div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">{tmpl.subject}</div>
                        </div>
                        {templateName === tmpl.name && <Check className="w-3 h-3 text-indigo-400 ml-auto shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template Name..."
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 w-40 hidden lg:block"
            />

            <button
              onClick={handleSaveTemplate}
              disabled={isSaving}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors shrink-0"
            >
              {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savedSuccess ? 'Saved!' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor & Preview Grid */}
      <div className={`grid gap-6 ${isFullPreview ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
        {/* Left Column: Template Form & Variables */}
        {!isFullPreview && (
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              {/* Dynamic Variables Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3 h-3 text-indigo-400" />
                    Dynamic Variables
                  </label>
                  <button
                    onClick={() => setShowVariableHelp(!showVariableHelp)}
                    className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    {showVariableHelp ? 'Hide Help' : 'What are these?'}
                  </button>
                </div>

                {/* Variable Help Tooltip */}
                {showVariableHelp && (
                  <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 mb-3 text-[11px] text-indigo-200/80 space-y-1.5 compose-dropdown-enter">
                    <p className="text-indigo-300 font-semibold flex items-center gap-1.5">
                      <Info className="w-3 h-3" /> Variable Reference
                    </p>
                    {TEMPLATE_VARIABLES.map((v) => (
                      <div key={v.tag} className="flex items-start gap-2">
                        <code className="text-indigo-300 bg-slate-900/60 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0">{v.tag}</code>
                        <span className="text-slate-400">{v.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.tag}
                      onClick={() => handleInsertTag(v.tag)}
                      title={v.description}
                      className="group px-2.5 py-1 rounded-lg text-xs font-mono font-medium text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 hover:bg-indigo-900/80 hover:border-indigo-400/50 transition-all"
                    >
                      <span className="text-indigo-500/70 group-hover:text-indigo-400">+</span> {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email Subject Input */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-slate-400" />
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Your Certificate of Completion: {{name}}"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Rich Formatting Toolbar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-indigo-400" /> Email Body (HTML)
                  </label>
                  <span className="text-[10px] text-slate-500">Click to insert at cursor position</span>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-0.5 p-1.5 bg-slate-950 border border-slate-700/80 border-b-0 rounded-t-xl">
                  <button
                    onClick={() => handleFormat('bold')}
                    title="Bold"
                    className="compose-toolbar-btn"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat('italic')}
                    title="Italic"
                    className="compose-toolbar-btn"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  <button
                    onClick={() => handleFormat('heading')}
                    title="Heading"
                    className="compose-toolbar-btn"
                  >
                    <Heading className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat('paragraph')}
                    title="Paragraph"
                    className="compose-toolbar-btn"
                  >
                    <Type className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  <button
                    onClick={() => handleFormat('link')}
                    title="Insert Link"
                    className="compose-toolbar-btn"
                  >
                    <Link className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat('hr')}
                    title="Horizontal Rule"
                    className="compose-toolbar-btn"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  <button
                    onClick={() => handleFormat('ul')}
                    title="Bullet List"
                    className="compose-toolbar-btn"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFormat('ol')}
                    title="Numbered List"
                    className="compose-toolbar-btn"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={14}
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-b-xl p-3.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Live Recipient Email Preview */}
        <div className={isFullPreview ? '' : 'lg:col-span-5'}>
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 sticky top-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-400" /> Live Preview
              </h3>

              <div className="flex items-center gap-2">
                {/* Full preview toggle */}
                <button
                  onClick={() => setIsFullPreview(!isFullPreview)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
                  title={isFullPreview ? 'Show Editor' : 'Full-Width Preview'}
                >
                  {isFullPreview ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>

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
              <div className={`p-4 bg-white text-slate-900 overflow-y-auto ${isFullPreview ? 'max-h-[600px]' : 'max-h-[380px]'}`}>
                <div dangerouslySetInnerHTML={{ __html: previewBody }} />
              </div>
            </div>

            {/* Preview info */}
            <p className="text-[10px] text-slate-500 text-center">
              Showing interpolated preview for: <strong className="text-slate-400">{currentRecipient?.recipient.name || 'Sample'}</strong>
              {matchedRecipients.length > 1 && ` (${selectedRecipientIndex + 1} of ${matchedRecipients.length})`}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4">
        <p className="text-xs text-slate-400">
          {savedSuccess ? (
            <span className="text-emerald-400 font-medium">✓ Template saved successfully!</span>
          ) : (
            'Ensure your SMTP configuration is verified before mass sending.'
          )}
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
