import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['nodemailer', 'xlsx', 'jszip', 'papaparse'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
