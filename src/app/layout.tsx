import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DiploMail — Automated Certificate & PDF Mailer",
  description: "Automatically email personalized PDF certificates and diplomas to recipients with smart filename matching.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
