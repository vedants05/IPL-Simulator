/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep verification builds separate from the live development cache when
  // NEXT_DIST_DIR is supplied. Production and normal development still use
  // Next.js' standard `.next` directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
