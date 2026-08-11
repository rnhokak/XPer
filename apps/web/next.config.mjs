/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/app',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/app',
          destination: '/app/index.html',
        },
      ],
      afterFiles: [
        // SPA fallback for the Vite app under /app
        {
          source: '/app/:path*',
          destination: '/app/index.html',
        },
      ],
    };
  },
};

export default nextConfig;
