import type { NextConfig } from "next";

// Set NEXT_PUBLIC_BASE_PATH=/statistical-twin to serve under a sub-path
// (e.g. aryamantepal.com/statistical-twin). Empty for a standalone deploy.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
