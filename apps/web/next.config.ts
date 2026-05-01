import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  transpilePackages: [
    "@autoledger/config",
    "@autoledger/shared",
    "@autoledger/ui-tokens",
    "@autoledger/validation",
  ],
};

export default nextConfig;
