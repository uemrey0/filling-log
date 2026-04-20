import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Filler Log',
    short_name: 'Filler',
    description: 'Filler performance tracking',
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
    },
    {
      src: "/web-app-manifest-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
  }
}
