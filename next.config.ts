import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Prevent build errors when DATABASE_URL is not yet set (e.g. first Vercel deploy)
  serverExternalPackages: ['pg'],
}

export default nextConfig
