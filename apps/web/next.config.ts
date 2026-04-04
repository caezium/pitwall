import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pitwall/api", "@pitwall/db", "@pitwall/shared"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
