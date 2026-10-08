import type { NextConfig } from "next";

// GitHub Pages serves static files only, so the app is exported as a static bundle.
// Set BASE_PATH=/your-repo for a project site (https://<user>.github.io/<repo>).
// Leave it empty for a user/org site (https://<user>.github.io).
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
