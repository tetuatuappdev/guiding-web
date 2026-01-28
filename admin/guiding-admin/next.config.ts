import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/pwa",
        destination: "/pwa/index.html",
      },
      {
        source: "/pwa/",
        destination: "/pwa/index.html",
      },
    ];
  },
};

export default nextConfig;
