/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep development chunks separate from production builds, including
  // builds run without NEXT_DIST_DIR while the dev server is running.
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
};

export default nextConfig;
