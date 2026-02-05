/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'standalone', // Disabled for simpler deployment with npm start
  experimental: {
    // Allow large recording uploads (default can truncate at 1MB)
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

module.exports = nextConfig
