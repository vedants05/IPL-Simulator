/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep production verification builds away from a running development
  // server's .next cache. The pre-push check sets NEXT_DIST_DIR explicitly.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
