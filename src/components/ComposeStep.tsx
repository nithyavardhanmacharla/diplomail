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
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
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
  Edit3,
  Undo2,
  Redo2,
  Sliders,
  PaintBucket,
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
  { tag: '{{name}}', label: 'Name', description: "Recipient's full name from CSV" },
  { tag: '{{email}}', label: 'Email', description: "Recipient's email address" },
  { tag: '{{filename}}', label: 'Filename', description: 'Matched PDF certificate filename' },
  { tag: '{{customMessage}}', label: 'Custom Msg', description: 'Per-recipient custom message from CSV' },
  { tag: '{{subject}}', label: 'Subject', description: 'Per-recipient subject override from CSV' },
  { tag: '{{trackingUrl}}', label: 'Download Link', description: 'Auto-generated certificate download & tracking link' },
];

const THEME_PRESETS = [
  { id: 'indigo', name: 'Royal Indigo', gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)', primary: '#4f46e5', accent: '#6366f1' },
  { id: 'emerald', name: 'Emerald Teal', gradient: 'linear-gradient(135deg, #059669, #0d9488)', primary: '#059669', accent: '#10b981' },
  { id: 'blue', name: 'Ocean Sapphire', gradient: 'linear-gradient(135deg, #2563eb, #0284c7)', primary: '#2563eb', accent: '#38bdf8' },
  { id: 'amber', name: 'Sunset Amber', gradient: 'linear-gradient(135deg, #d97706, #ea580c)', primary: '#d97706', accent: '#f59e0b' },
  { id: 'rose', name: 'Rose Violet', gradient: 'linear-gradient(135deg, #e11d48, #9333ea)', primary: '#e11d48', accent: '#f43f5e' },
  { id: 'slate', name: 'Midnight Minimal', gradient: 'linear-gradient(135deg, #1e293b, #0f172a)', primary: '#334155', accent: '#64748b' },
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
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
  const [selectedRecipientIndex, setSelectedRecipientIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showVariableHelp, setShowVariableHelp] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showQuickCustomizer, setShowQuickCustomizer] = useState(false);
  const [isFullPreview, setIsFullPreview] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const visualEditorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Load saved templates on mount
  useEffect(() => {
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) setSavedTemplates(data.templates);
      })
      .catch((err) => console.error('Failed to load templates:', err));
  }, []);

  // Sync content into Visual Editor whenever bodyHtml changes externally or mode switches to visual
  useEffect(() => {
    if (editorMode === 'visual' && visualEditorRef.current) {
      if (visualEditorRef.current.innerHTML !== bodyHtml) {
        visualEditorRef.current.innerHTML = bodyHtml;
      }
    }
  }, [editorMode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTemplateDropdown(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matchedRecipients = batch.recipients.filter(
    (r) => r.status === 'MATCHED_EXACT' || r.status === 'MATCHED_FUZZY' || r.status === 'MANUAL_OVERRIDE'
  );

  const currentRecipient = matchedRecipients[selectedRecipientIndex] || batch.recipients[0];

  // Visual contentEditable input handler
  const handleVisualInput = () => {
    if (visualEditorRef.current) {
      const newHtml = visualEditorRef.current.innerHTML;
      setBodyHtml(newHtml);
    }
  };

  // Cursor-aware variable/text insertion for HTML Mode
  const insertAtHtmlCursor = useCallback(
    (text: string) => {
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

      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      });
    },
    [bodyHtml]
  );

  // Insert variable tag cleanly in either Visual or HTML mode
  const handleInsertTag = (tag: string) => {
    if (editorMode === 'visual') {
      if (visualEditorRef.current) {
        visualEditorRef.current.focus();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(tag);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          document.execCommand('insertText', false, tag);
        }
        setBodyHtml(visualEditorRef.current.innerHTML);
      }
    } else {
      insertAtHtmlCursor(tag);
    }
  };

  // Execute formatting command in Visual mode or insert tags in HTML mode
  const handleVisualCommand = (command: string, value: string | undefined = undefined) => {
    if (editorMode === 'visual') {
      if (visualEditorRef.current) {
        visualEditorRef.current.focus();
        document.execCommand(command, false, value);
        setBodyHtml(visualEditorRef.current.innerHTML);
      }
    } else {
      // HTML mode fallback
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = bodyHtml.substring(start, end);

      let insertion = '';
      switch (command) {
        case 'bold':
          insertion = `<strong>${selectedText || 'bold text'}</strong>`;
          break;
        case 'italic':
          insertion = `<em>${selectedText || 'italic text'}</em>`;
          break;
        case 'underline':
          insertion = `<u>${selectedText || 'underlined text'}</u>`;
          break;
        case 'strikeThrough':
          insertion = `<s>${selectedText || 'strikethrough text'}</s>`;
          break;
        case 'formatBlock':
          insertion = `<${value || 'h2'} style="color: #1e293b; font-weight: 700; margin: 16px 0 8px 0;">${selectedText || 'Heading'}</${value || 'h2'}>`;
          break;
        case 'createLink':
          insertion = `<a href="${value || 'https://example.com'}" style="color: #4f46e5; text-decoration: underline;" target="_blank">${selectedText || 'Link Text'}</a>`;
          break;
        case 'insertHorizontalRule':
          insertion = `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`;
          break;
        case 'insertUnorderedList':
          insertion = `<ul style="margin: 12px 0; padding-left: 20px;"><li>${selectedText || 'List item'}</li></ul>`;
          break;
        case 'insertOrderedList':
          insertion = `<ol style="margin: 12px 0; padding-left: 20px;"><li>${selectedText || 'List item'}</li></ol>`;
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
    }
  };

  const handlePromptLink = () => {
    const url = window.prompt('Enter URL link:', 'https://');
    if (url) {
      handleVisualCommand('createLink', url);
    }
  };

  const handleApplyTheme = (theme: typeof THEME_PRESETS[0]) => {
    let updated = bodyHtml;
    // Replace gradient in header banner & button
    updated = updated.replace(/background:\s*linear-gradient\([^)]+\)/g, `background: ${theme.gradient}`);
    updated = updated.replace(/border-left:\s*4px solid\s*#[a-fA-F0-9]{6}/g, `border-left: 4px solid ${theme.accent}`);
    setBodyHtml(updated);
    if (visualEditorRef.current) {
      visualEditorRef.current.innerHTML = updated;
    }
    setShowThemePicker(false);
  };

  const handleSelectTemplate = (template: EmailTemplate) => {
    setTemplateName(template.name);
    setSubject(template.subject);
    setBodyHtml(template.bodyHtml);
    if (visualEditorRef.current) {
      visualEditorRef.current.innerHTML = template.bodyHtml;
    }
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
        onUpdateBatch({
          ...batch,
          template: templateObj,
        });

        fetch(`/api/batch/${batch.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: templateObj }),
        }).catch((e) => console.warn('Template sync warning:', e));
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
  const previewBody = useMemo(
    () =>
      DOMPurify.sanitize(rawPreviewBody, {
        ALLOWED_TAGS: [
          'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'br', 'hr',
          'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'pre', 'blockquote', 'ul',
          'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'style', 'class', 'target', 'rel', 'width', 'height', 'colspan', 'rowspan',
        ],
      }),
    [rawPreviewBody]
  );

  const isSmtpConfigured = Boolean(smtpConfig.user && smtpConfig.pass);

  // Approximate email size
  const emailSizeKb = useMemo(() => {
    const totalChars = (subject.length + bodyHtml.length) * 2;
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
            Edit your email template visually or in code, insert variables, and preview recipient outputs in real-time.
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

      {/* Template & Editor Control Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Template Selector */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Wand2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 shrink-0">Preset:</span>

            {/* Template Dropdown */}
            <div className="relative flex-1 max-w-sm" ref={dropdownRef}>
              <button
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="w-full flex items-center justify-between gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 hover:border-indigo-500/50 transition-colors"
              >
                <span className="truncate font-medium">{templateName}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              {showTemplateDropdown && (
                <div className="absolute top-full left-0 mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden compose-dropdown-enter">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Choose a Template
                    </span>
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

          {/* Editor Mode Switcher Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center">
              <button
                onClick={() => {
                  setEditorMode('visual');
                  if (visualEditorRef.current) visualEditorRef.current.innerHTML = bodyHtml;
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  editorMode === 'visual'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>🎨 Visual Editor</span>
              </button>

              <button
                onClick={() => setEditorMode('html')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  editorMode === 'html'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>💻 HTML Code</span>
              </button>
            </div>

            {/* Color Theme Selector */}
            <div className="relative" ref={themeRef}>
              <button
                onClick={() => setShowThemePicker(!showThemePicker)}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-950 border border-slate-800 hover:border-indigo-500/40 transition-colors"
                title="Change Email Color Theme"
              >
                <PaintBucket className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Theme</span>
              </button>

              {showThemePicker && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-1 compose-dropdown-enter">
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Color Scheme
                  </div>
                  {THEME_PRESETS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleApplyTheme(t)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-800 flex items-center gap-2 transition-colors text-slate-200"
                    >
                      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: t.gradient }} />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSaveTemplate}
              disabled={isSaving}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors shrink-0"
            >
              {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savedSuccess ? 'Saved!' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor & Preview Grid */}
      <div className={`grid gap-6 ${isFullPreview ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
        {/* Left Column: Template Form & Visual / HTML Canvas */}
        {!isFullPreview && (
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              {/* Dynamic Variables Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3 h-3 text-indigo-400" />
                    Insert Dynamic Tags
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
                        <code className="text-indigo-300 bg-slate-900/60 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0">
                          {v.tag}
                        </code>
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
                      title={`Click to insert ${v.tag}: ${v.description}`}
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

              {/* Editor Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    {editorMode === 'visual' ? (
                      <>
                        <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Visual Editor (Click &amp; Type Directly)</span>
                      </>
                    ) : (
                      <>
                        <Code className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Email Source (HTML)</span>
                      </>
                    )}
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {editorMode === 'visual' ? '💡 Click anywhere on the email to edit text' : 'Edit raw HTML code'}
                  </span>
                </div>

                {/* Rich Formatting Toolbar */}
                <div className="flex items-center gap-0.5 p-1.5 bg-slate-950 border border-slate-700/80 border-b-0 rounded-t-xl flex-wrap">
                  <button
                    onClick={() => handleVisualCommand('bold')}
                    title="Bold (Ctrl+B)"
                    className="compose-toolbar-btn"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVisualCommand('italic')}
                    title="Italic (Ctrl+I)"
                    className="compose-toolbar-btn"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVisualCommand('underline')}
                    title="Underline (Ctrl+U)"
                    className="compose-toolbar-btn"
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVisualCommand('strikeThrough')}
                    title="Strikethrough"
                    className="compose-toolbar-btn"
                  >
                    <Strikethrough className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  <button
                    onClick={() => handleVisualCommand('formatBlock', 'h1')}
                    title="Heading 1"
                    className="compose-toolbar-btn"
                  >
                    <Heading1 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVisualCommand('formatBlock', 'h2')}
                    title="Heading 2"
                    className="compose-toolbar-btn"
                  >
                    <Heading2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVisualCommand('formatBlock', 'p')}
                    title="Paragraph"
                    className="compose-toolbar-btn"
                  >
                    <Type className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  <button
                    onClick={() => handleVisualCommand('justifyLeft')}
                    title="Align Left"
                    className="compose-toolbar-btn"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVisualCommand('justifyCenter')}
                    title="Align Center"
                    className="compose-toolbar-btn"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVisualCommand('justifyRight')}
                    title="Align Right"
                    className="compose-toolbar-btn"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  <button
                    onClick={() => handleVisualCommand('insertUnorderedList')}
                    title="Bullet List"
                    className="compose-toolbar-btn"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVisualCommand('insertOrderedList')}
                    title="Numbered List"
                    className="compose-toolbar-btn"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  <button
                    onClick={handlePromptLink}
                    title="Insert Link"
                    className="compose-toolbar-btn"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVisualCommand('insertHorizontalRule')}
                    title="Horizontal Rule"
                    className="compose-toolbar-btn"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-5 bg-slate-700 mx-1" />

                  <button
                    onClick={() => handleVisualCommand('undo')}
                    title="Undo"
                    className="compose-toolbar-btn"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleVisualCommand('redo')}
                    title="Redo"
                    className="compose-toolbar-btn"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Editor Surface: Visual or HTML */}
                {editorMode === 'visual' ? (
                  <div className="relative">
                    {/* Visual Editable Canvas */}
                    <div
                      ref={visualEditorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={handleVisualInput}
                      onBlur={handleVisualInput}
                      className="w-full min-h-[380px] max-h-[500px] overflow-y-auto bg-white text-slate-900 border border-slate-700/80 rounded-b-xl p-5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all font-sans"
                      style={{ outline: 'none' }}
                    />
                    <div className="bg-slate-900/80 border-t border-slate-800 px-3 py-1.5 text-[11px] text-slate-400 flex items-center justify-between rounded-b-xl">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        WYSIWYG Visual Mode Active
                      </span>
                      <button
                        onClick={() => setEditorMode('html')}
                        className="text-indigo-400 hover:text-indigo-300 text-[10px] underline"
                      >
                        Switch to HTML code
                      </button>
                    </div>
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    rows={14}
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-b-xl p-3.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed transition-colors"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Live Recipient Email Preview */}
        <div className={isFullPreview ? '' : 'lg:col-span-5'}>
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 sticky top-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-400" /> Recipient Live Preview
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
                  <strong className="text-slate-300">To:</strong>{' '}
                  {currentRecipient?.recipient.email || 'recipient@example.com'}
                </div>
                <div className="text-xs font-semibold text-indigo-300 pt-1">Subject: {previewSubject}</div>
                {currentRecipient?.matchedPdfName && (
                  <div className="text-[11px] text-emerald-400 font-medium pt-1 flex items-center gap-1">
                    📎 Attachment: {currentRecipient.matchedPdfName}
                  </div>
                )}
              </div>

              {/* Email Content Render */}
              <div
                className={`p-4 bg-white text-slate-900 overflow-y-auto ${
                  isFullPreview ? 'max-h-[600px]' : 'max-h-[380px]'
                }`}
              >
                <div dangerouslySetInnerHTML={{ __html: previewBody }} />
              </div>
            </div>

            {/* Preview info */}
            <p className="text-[10px] text-slate-500 text-center">
              Showing preview for:{' '}
              <strong className="text-slate-400">{currentRecipient?.recipient.name || 'Sample Recipient'}</strong>
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
            'Ensure your email looks perfect in preview before proceeding to send.'
          )}
        </p>

        <button
          onClick={handleProceed}
          className="flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/25 hover:scale-[1.02] transition-all"
        >
          <span>Next: Review &amp; Send</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
