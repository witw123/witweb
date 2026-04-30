import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  transpilePackages: [
    "@livekit/components-react",
    "@livekit/components-styles",
    "livekit-client",
    "livekit-server-sdk"
  ],
};

export default nextConfig;
