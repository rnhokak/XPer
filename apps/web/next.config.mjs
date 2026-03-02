/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/app',
        destination: '/app/index.html',
      },
      {
        // Rewrite SPA routes to index.html (exclude assets and files with extensions)
        source: '/app/:path((?!assets/)(?!.*\\..*$).*)',
        destination: '/app/index.html',
      },
    ];
  },
};

export default nextConfig;
