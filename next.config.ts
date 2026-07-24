import path from "node:path";
import type { NextConfig } from "next";

// Next.js configuration for the Jikahoot app.

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
