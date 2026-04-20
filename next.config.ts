import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg'],
  allowedDevOrigins: ['192.168.1.154'],
}

export default nextConfig
