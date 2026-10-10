import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plain static files (out/). In production they're served by Laravel from the same
  // origin as the API, so the whole app is one service with no CORS to configure.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
