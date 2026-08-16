import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DiploMail — Automated Certificate & PDF Batch Mailer",
  description:
    "DiploMail is a powerful automated platform for emailing personalized PDF certificates, diplomas, and documents to recipients at scale — with smart filename matching, real-time delivery tracking, and CSV export reports.",
  keywords: [
    "certificate mailer",
    "batch email",
    "PDF certificates",
    "diploma delivery",
    "automated mailer",
    "bulk email sender",
    "DiploMail",
  ],
  authors: [{ name: "M. Nithya Vardhan" }],
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "DiploMail — Automated Certificate & PDF Batch Mailer",
    description:
      "Email personalized PDF certificates to recipients at scale with smart matching, tracking, and reports.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Content Security Policy — defense-in-depth against XSS */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
