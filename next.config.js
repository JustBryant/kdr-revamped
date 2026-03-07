/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  // Disable React Strict Mode in dev to avoid double renders and slightly faster dev refreshes
  reactStrictMode: isProd ? true : false,
  // Skip TypeScript type checking during dev to reduce compile latency. Keep checks in CI/build.
  typescript: {
    ignoreBuildErrors: !isProd,
  },
  images: {
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.ygoprodeck.com',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
    ],
  },
}

module.exports = nextConfig
