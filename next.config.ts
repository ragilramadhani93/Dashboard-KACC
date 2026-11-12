import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel uses its own Next.js adapter; standalone is only for self-hosted/Docker.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
