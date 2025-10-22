import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',

  //TODO REMOVE THIS
  eslint: {
    ignoreDuringBuilds: true, 
  },
};

export default nextConfig;
