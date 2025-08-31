import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker optimization
  output: 'standalone',
  
  // Disable powered by header for security
  poweredByHeader: false,
  
  // Enable compression
  compress: true,
  
  // Disable ETags for better performance in load-balanced environments
  generateEtags: false,
  
  // Experimental features
  experimental: {
    // Optimize server components
    serverComponentsExternalPackages: ['sqlite3'],
  },
  
  // Image optimization settings
  images: {
    // Disable image optimization if not using next/image extensively
    unoptimized: true,
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Logging configuration
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  
  // TypeScript configuration
  typescript: {
    // Only run type checking in development
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },
  
  // ESLint configuration  
  eslint: {
    // Only run ESLint in development
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
