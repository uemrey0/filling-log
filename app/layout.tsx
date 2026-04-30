import type { Metadata, Viewport } from 'next'
import './globals.css'
import { LanguageProvider } from '@/components/providers/LanguageProvider'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'FillerLog',
  description: 'Supermarkt filler prestatie tracking',
  appleWebApp: {
    capable: true,
    title: 'Filler Log',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#80BC17',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="h-full">
      <head>
      </head>
      <body className="h-full">
        <LanguageProvider>
          {children}
          <Toaster position="top-center" richColors />
        </LanguageProvider>
      </body>
    </html>
  )
}
