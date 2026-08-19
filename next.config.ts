import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['nodemailer', 'xlsx', 'jszip', 'papaparse'],

  // Allow larger request bodies for PDF-bearing API calls (default 1MB is too small)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Security headers applied at the framework level
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      ],
    },
  ],
};

export default nextConfig;
