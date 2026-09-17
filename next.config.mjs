/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep pdfjs-dist as an external Node module in the server/serverless
    // bundle instead of letting webpack bundle it. This avoids the worker
    // chunk being split into `.next/server/chunks/pdf.worker.mjs` (which then
    // cannot be resolved at runtime on Vercel/Lambda). Combined with the
    // workerless config in lib/server/pdf.ts, PDF text extraction runs on the
    // main thread with no external worker file.
    serverComponentsExternalPackages: ["pdfjs-dist"],
  },
};

export default nextConfig;
