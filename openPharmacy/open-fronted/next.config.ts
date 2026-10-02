import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.14"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
