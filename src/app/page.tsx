'use client';

import React, { useState, useEffect } from 'react';
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
        <p>DiploMail — Automated Certificate & PDF Batch Delivery System</p>
        <p className="font-medium text-slate-300">
          © 2026 M. Nithya Vardhan · Designed & Developed by{' '}
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
