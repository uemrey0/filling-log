import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FillerLog',
    short_name: 'Filler',
    description: 'Supermarkt filler prestatie tracking',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F4F6F3',
    theme_color: '#80BC17',
    lang: 'nl',
    icons: [
    {
      src: "/web-app-manifest-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable"
    },
    {
      src: "/web-app-manifest-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable"
    }
  ],
  }
}
