import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev only: let the HMR websocket connect when the app is opened as http://127.0.0.1:3000.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
