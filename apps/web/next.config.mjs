/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Host the cashflow SPA from public/app/cashflow while preserving asset paths.
    return [
      {
        source: "/app/cashflow/assets/:path*",
        destination: "/app/cashflow/assets/:path*",
      },
      {
        source: "/app/cashflow",
        destination: "/app/cashflow/index.html",
      },
      {
        // Rewrite SPA routes (no file extensions, not assets) to index.html.
        source: "/app/cashflow/:path((?!assets/)(?!.*\\\\..*$).*)",
        destination: "/app/cashflow/index.html",
      },
    ];
  },
};

export default nextConfig;
