'use strict';
'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Award, CheckCircle, FileText, Mail, ShieldCheck, ArrowLeft, ExternalLink } from 'lucide-react';

function CertificateContent() {
  const searchParams = useSearchParams();
  const name = searchParams.get('name') || 'Recipient';
  const filename = searchParams.get('filename') || 'Certificate.pdf';
  const email = searchParams.get('email') || '';
  const status = searchParams.get('status') || 'verified';

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="max-w-lg w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 text-center relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Certificate Icon Header */}
        <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-500/20">
          <Award className="w-10 h-10 text-white" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            Official Verified Credential
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Certificate Delivered
          </h1>
          <p className="text-sm text-slate-400">
            This certificate has been issued and dispatched via DiploMail.
          </p>
        </div>

        {/* Recipient Details Card */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 text-left space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Recipient Name</span>
            <span className="text-sm font-semibold text-slate-100">{name}</span>
          </div>

          {email && (
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Recipient Email</span>
              <span className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                {email}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Attached Document</span>
            <span className="text-sm font-medium text-indigo-300 flex items-center gap-1.5 truncate max-w-[220px]">
              <FileText className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
              <span className="truncate">{filename}</span>
            </span>
          </div>
        </div>

        {/* Live Certificate PDF Viewer Embed */}
        <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 min-h-[380px] sm:min-h-[460px] relative shadow-2xl">
          <iframe
            src={`/api/track/click?name=${encodeURIComponent(name)}&filename=${encodeURIComponent(filename)}&email=${encodeURIComponent(email)}`}
            className="w-full h-[380px] sm:h-[460px] border-0"
            title="Official Certificate Document"
          />
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`/api/track/click?name=${encodeURIComponent(name)}&filename=${encodeURIComponent(filename)}&email=${encodeURIComponent(email)}&download=1`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02]"
          >
            <FileText className="w-4 h-4" />
            <span>📥 Download Certificate (.PDF)</span>
          </a>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors border border-slate-700/60"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to DiploMail
          </Link>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-slate-500">
          DiploMail • Secure Automated Certificate Dispatch
        </p>
      </div>
    </div>
  );
}

export default function CertificatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090d16] text-slate-400 flex items-center justify-center">
          Loading certificate...
        </div>
      }
    >
      <CertificateContent />
    </Suspense>
  );
}
