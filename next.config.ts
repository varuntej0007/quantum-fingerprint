import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow dev access from any device on the local network (Pi, phone, etc.)
  // -- safe for local development, not something to carry into production.
  allowedDevOrigins: ["192.168.1.4", "192.168.1.7", "localhost", "127.0.0.1"],
};

export default nextConfig;
