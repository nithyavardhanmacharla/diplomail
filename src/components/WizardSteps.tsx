'use client';

import React from 'react';
import { Upload, CheckCircle2, Mail, Send, FileSpreadsheet, Sparkles } from 'lucide-react';

export type WizardStepId = 'upload' | 'matching' | 'compose' | 'sending' | 'report';

interface WizardStepsProps {
  currentStep: WizardStepId;
  onSelectStep: (step: WizardStepId) => void;
  canNavigate: boolean;
}

const STEPS: { id: WizardStepId; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'upload', label: 'Upload Files', icon: Upload, description: 'Spreadsheet & Certificates' },
  { id: 'matching', label: 'Match & Preview', icon: CheckCircle2, description: 'Filename Matching Engine' },
  { id: 'compose', label: 'Compose Email', icon: Mail, description: 'Template & SMTP Gateway' },
  { id: 'sending', label: 'Review & Send', icon: Send, description: 'Rate-limited Dispatch' },
  { id: 'report', label: 'Report & Export', icon: FileSpreadsheet, description: 'Sent Logs & CSV Export' },
];

export const WizardSteps: React.FC<WizardStepsProps> = ({
  currentStep,
  onSelectStep,
  canNavigate,
}) => {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="w-full mb-8">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = idx < currentIndex;
          const isAccessible = canNavigate || isCompleted || isActive;

          return (
            <button
              key={step.id}
              disabled={!isAccessible}
              onClick={() => isAccessible && onSelectStep(step.id)}
              className={`relative flex flex-col p-3 rounded-xl border text-left transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-b from-indigo-950/70 to-slate-900 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                  : isCompleted
                  ? 'bg-slate-900/60 border-slate-700/60 hover:border-slate-600 text-slate-300'
                  : 'bg-slate-950/40 border-slate-800/40 text-slate-500 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>

                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500'
                }`}>
                  Step {idx + 1}
                </span>
              </div>

              <h3 className={`text-xs font-semibold ${isActive ? 'text-indigo-300' : isCompleted ? 'text-slate-200' : 'text-slate-400'}`}>
                {step.label}
              </h3>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">{step.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
