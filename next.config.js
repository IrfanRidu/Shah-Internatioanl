/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal, self-contained `.next/standalone` build (only the
  // files actually needed at runtime, with a tiny server.js entrypoint) —
  // used by the multi-stage Dockerfile to keep the final image small.
  // Has no effect on `next dev` or a standard Vercel deploy.
  output: 'standalone',
  images: {
    domains: ['res.cloudinary.com', 'images.unsplash.com', 'via.placeholder.com', 'lh3.googleusercontent.com'],
  },
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'jspdf', 'jspdf-autotable'],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
}
module.exports = nextConfig
