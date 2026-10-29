import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["*.replit.dev", "*.replit.app", "localhost", "127.0.0.1"],
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/postwave/api/:path*",
          destination: "/api/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
