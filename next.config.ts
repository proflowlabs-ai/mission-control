import type { NextConfig } from "next";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from the root .env file
dotenv.config({ 
  path: path.resolve(__dirname, "../.env"),
  quiet: true 
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Proxy backend API calls to Mission Control Express server
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:4000/api/:path*",
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:4000/health",
      },
    ];
  },
};

export default nextConfig;
