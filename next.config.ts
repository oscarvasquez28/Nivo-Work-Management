import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.NIVO_API_URL ?? "http://127.0.0.1:4000"}/api/:path*` }];
  },
};

export default nextConfig;
