import type { Metadata } from 'next'
import './globals.css'
import { LanguageProvider } from '@/components/providers/LanguageProvider'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'FillerLog',
  description: 'Supermarkt filler prestatie tracking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="h-full">
      <body className="h-full">
        <LanguageProvider>
          {children}
          <Toaster position="top-center" richColors />
        </LanguageProvider>
      </body>
    </html>
  )
}
