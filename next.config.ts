import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Prevent TypeScript check failures from stopping production builds on Vercel
    ignoreBuildErrors: true,
  },
  eslint: {
    // Prevent ESLint warnings/errors from stopping production builds on Vercel
    ignoreDuringBuilds: true,
  },
  // Allow cross-origin requests from any LAN/Wi-Fi devices during development
  // (Prevents Next.js / Turbopack from blocking asset chunks and Fast Refresh on network IPs)
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '*.local',
    '192.168.*.*',
    '192.168.*',
    '10.*.*.*',
    '10.*',
    '172.*.*.*',
    '172.*',
    '**',
  ],
};

export default nextConfig;
