import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pitwall/api", "@pitwall/db", "@pitwall/shared"],
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "better-sqlite3",
      ];
    }
    return config;
  },
};

export default nextConfig;
