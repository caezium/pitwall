import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // disabled — causes React Client Manifest issues in Docker
  transpilePackages: ["@pitwall/api", "@pitwall/shared"],
  serverExternalPackages: ["better-sqlite3", "@pitwall/db"],
};

export default nextConfig;
