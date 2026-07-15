import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.0.56'],
  output: "standalone",
};

export default nextConfig;
