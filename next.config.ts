import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

// Check if building for Tauri (native app)
const isTauriBuild = process.env.BUILD_TARGET === "tauri";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Disable PWA for development and Tauri builds
  disable: process.env.NODE_ENV === "development" || isTauriBuild,
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Add empty turbopack config to silence the warning
  turbopack: {},
  // Enable static export for Tauri builds
  ...(isTauriBuild && {
    output: "export",
  }),
};

export default withPWA(nextConfig);

