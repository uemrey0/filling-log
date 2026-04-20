import type { Metadata, Viewport } from 'next'
import './globals.css'
import { LanguageProvider } from '@/components/providers/LanguageProvider'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'FillerLog',
  description: 'Supermarkt filler prestatie tracking',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="h-full">
      <head>
        <meta name="apple-mobile-web-app-title" content="Filler Log" />
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
