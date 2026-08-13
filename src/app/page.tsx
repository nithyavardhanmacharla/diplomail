'use client';

import React, { useState, useEffect } from 'react';
import {
  Upload,
  Search,
  Send,
  FileSpreadsheet,
  BarChart3,
  Eye,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { WizardSteps, WizardStepId } from '@/components/WizardSteps';
import { UploadStep } from '@/components/UploadStep';
import { MatchingStep } from '@/components/MatchingStep';
import { ComposeStep } from '@/components/ComposeStep';
import { SendingStep } from '@/components/SendingStep';
import { ReportStep } from '@/components/ReportStep';
import { SmtpModal } from '@/components/SmtpModal';
import { HistoryModal } from '@/components/HistoryModal';
import { PdfViewerModal } from '@/components/PdfViewerModal';
import { BatchSession, SmtpConfig, PdfFileInfo } from '@/lib/types';

/* ────────────────────────────────────────────────
   Hero Section — Website Description & Features
   ──────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Search,
    title: 'Smart Filename Matching',
    description:
      'Automatically maps recipient names to PDF certificate filenames using fuzzy Levenshtein distance matching with adjustable thresholds.',
    color: 'indigo',
  },
  {
    icon: Send,
    title: 'Throttled Bulk Sending',
    description:
      'Rate-limited email dispatch with pause & resume controls, protecting your sender reputation against SMTP provider limits.',
    color: 'purple',
  },
  {
    icon: Eye,
    title: 'Read-Receipt Tracking',
    description:
      'WhatsApp-style delivery status — track Sent → Delivered → Seen stages with 1×1 tracking pixel and click-through detection.',
    color: 'sky',
  },
  {
    icon: FileSpreadsheet,
    title: 'CSV Export & Reports',
    description:
      'Download detailed delivery audit logs as CSV with recipient names, timestamps, match confidence scores, and error reasons.',
    color: 'emerald',
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; iconBg: string; iconBorder: string }> = {
  indigo: {
    bg: 'bg-indigo-500/5',
    border: 'border-indigo-500/20',
    text: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10',
    iconBorder: 'border-indigo-500/25',
  },
  purple: {
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    iconBorder: 'border-purple-500/25',
  },
  sky: {
    bg: 'bg-sky-500/5',
    border: 'border-sky-500/20',
    text: 'text-sky-400',
    iconBg: 'bg-sky-500/10',
    iconBorder: 'border-sky-500/25',
  },
  emerald: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    iconBorder: 'border-emerald-500/25',
  },
};

function HeroSection() {
  return (
    <section className="relative overflow-hidden mb-4">
      {/* Decorative background orbs */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-indigo-600/10 blur-3xl hero-glow-orb pointer-events-none" />
      <div className="absolute -bottom-16 -right-24 w-64 h-64 rounded-full bg-purple-600/10 blur-3xl hero-glow-orb pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* Main hero content */}
      <div className="relative glass-panel rounded-2xl border border-slate-800/80 p-8 md:p-10 space-y-6">
        {/* Badge */}
        <div className="hero-float-in hero-float-in-delay-1 flex justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-indigo-300 border border-indigo-500/25 hero-shimmer-badge">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            Automated Certificate &amp; PDF Batch Delivery Platform
          </span>
        </div>

        {/* Headline */}
        <div className="hero-float-in hero-float-in-delay-2 text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Email Certificates at Scale with{' '}
            <span className="hero-gradient-text">DiploMail</span>
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed">
            Upload your recipient spreadsheet and PDF certificates, let our{' '}
            <strong className="text-slate-300">smart matching engine</strong> pair them
            automatically, compose beautiful emails, and dispatch them with{' '}
            <strong className="text-slate-300">real-time delivery tracking</strong> — all
            from one powerful dashboard.
          </p>
        </div>

        {/* How-it-works mini pipeline */}
        <div className="hero-float-in hero-float-in-delay-3 flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          {[
            { icon: Upload, label: 'Upload' },
            { icon: Search, label: 'Match' },
            { icon: Send, label: 'Send' },
            { icon: BarChart3, label: 'Track' },
          ].map((step, idx) => (
            <React.Fragment key={step.label}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800 text-xs font-medium text-slate-300">
                <step.icon className="w-3.5 h-3.5 text-indigo-400" />
                <span>{step.label}</span>
              </div>
              {idx < 3 && (
                <span className="text-slate-600 text-xs hidden sm:block">→</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Feature cards grid */}
        <div className="hero-float-in hero-float-in-delay-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {FEATURES.map((feat) => {
            const colors = COLOR_MAP[feat.color];
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className={`feature-card-hover rounded-xl border p-4 ${colors.bg} ${colors.border}`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 border ${colors.iconBg} ${colors.iconBorder}`}
                >
                  <Icon className={`w-4.5 h-4.5 ${colors.text}`} />
                </div>
                <h3 className="text-xs font-bold text-slate-200 mb-1">{feat.title}</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Security trust bar */}
        <div className="hero-float-in hero-float-in-delay-5 flex items-center justify-center gap-6 pt-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            End-to-End Secure
          </span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Rate-Limited Delivery
          </span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-sky-500" />
            Open Tracking
          </span>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────
   Main App
   ──────────────────────────────────────────────── */
export default function Home() {
  const [currentStep, setCurrentStep] = useState<WizardStepId>('upload');
  const [activeBatch, setActiveBatch] = useState<BatchSession | null>(null);
  const [smtpConfig, setSmtpConfig] = useState<Partial<SmtpConfig>>({});

  const [isSmtpModalOpen, setIsSmtpModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [previewPdf, setPreviewPdf] = useState<PdfFileInfo | null>(null);

  // Load saved SMTP config on mount
  useEffect(() => {
    fetch('/api/smtp/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.config) setSmtpConfig(data.config);
      })
      .catch((err) => console.error('Failed to load saved SMTP config:', err));
  }, []);

  const handleUploadSuccess = (batch: BatchSession) => {
    setActiveBatch(batch);
    setCurrentStep('matching');
  };

  const handleResetWizard = () => {
    setActiveBatch(null);
    setCurrentStep('upload');
  };

  const hasSmtpConfigured = Boolean(smtpConfig.user && smtpConfig.pass);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        hasSmtpConfig={hasSmtpConfigured}
        onOpenSmtpModal={() => setIsSmtpModalOpen(true)}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        onResetWizard={handleResetWizard}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Hero Description — shown on the upload step before a batch is started */}
        {currentStep === 'upload' && !activeBatch && <HeroSection />}

        {/* Wizard Steps Navigation Header */}
        <WizardSteps
          currentStep={currentStep}
          onSelectStep={(step) => setCurrentStep(step)}
          canNavigate={Boolean(activeBatch)}
        />

        {/* Step Content Panels */}
        {currentStep === 'upload' && (
          <UploadStep onUploadSuccess={handleUploadSuccess} />
        )}

        {currentStep === 'matching' && activeBatch && (
          <MatchingStep
            batch={activeBatch}
            onUpdateBatch={(updated) => setActiveBatch(updated)}
            onProceedToCompose={() => setCurrentStep('compose')}
            onPreviewPdf={(pdf) => setPreviewPdf(pdf)}
          />
        )}

        {currentStep === 'compose' && activeBatch && (
          <ComposeStep
            batch={activeBatch}
            smtpConfig={smtpConfig}
            onUpdateBatch={(updated) => setActiveBatch(updated)}
            onOpenSmtpModal={() => setIsSmtpModalOpen(true)}
            onProceedToSend={() => setCurrentStep('sending')}
          />
        )}

        {currentStep === 'sending' && activeBatch && (
          <SendingStep
            batch={activeBatch}
            smtpConfig={smtpConfig}
            onUpdateBatch={(updated) => setActiveBatch(updated)}
            onProceedToReport={() => setCurrentStep('report')}
            onOpenSmtpModal={() => setIsSmtpModalOpen(true)}
          />
        )}

        {currentStep === 'report' && activeBatch && (
          <ReportStep
            batch={activeBatch}
            onUpdateBatch={(updated) => setActiveBatch(updated)}
            onRestartNewBatch={handleResetWizard}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-400 space-y-1">
        <p>DiploMail — Automated Certificate &amp; PDF Batch Delivery System</p>
        <p className="font-medium text-slate-300">
          © 2026 M. Nithya Vardhan · Designed &amp; Developed by{' '}
          <a
            href="https://linkedin.com/in/nithyavardhanmacharla"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 font-semibold hover:text-indigo-300 hover:underline transition-colors"
          >
            M. Nithya Vardhan
          </a>
        </p>
      </footer>

      {/* Modals */}
      <SmtpModal
        isOpen={isSmtpModalOpen}
        onClose={() => setIsSmtpModalOpen(false)}
        smtpConfig={smtpConfig}
        onSaveConfig={(cfg) => setSmtpConfig(cfg)}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectBatch={(batch) => {
          setActiveBatch(batch);
          if (batch.status === 'COMPLETED') {
            setCurrentStep('report');
          } else if (batch.status === 'SENDING') {
            setCurrentStep('sending');
          } else {
            setCurrentStep('matching');
          }
        }}
      />

      <PdfViewerModal
        pdf={previewPdf}
        onClose={() => setPreviewPdf(null)}
      />
    </div>
  );
}
