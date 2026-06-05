/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'standalone', // Disabled for simpler deployment with npm start
  // Keep ffmpeg-static binary external so recording compression works in production
  serverExternalPackages: ['ffmpeg-static'],
  experimental: {
    // Allow large recording uploads (default can truncate at 1MB)
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

module.exports = nextConfig
