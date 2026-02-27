import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@livekit/components-react",
    "@livekit/components-styles",
    "livekit-client",
    "livekit-server-sdk"
  ],
};

export default nextConfig;
