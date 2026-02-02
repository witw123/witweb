import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: [
    "@livekit/components-react",
    "@livekit/components-styles",
    "livekit-client",
    "livekit-server-sdk"
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
