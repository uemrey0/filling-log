import type { Metadata } from 'next'
import './globals.css'
import { LanguageProvider } from '@/components/providers/LanguageProvider'

export const metadata: Metadata = {
  title: 'FillerLog',
  description: 'Supermarkt filler prestatie tracking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="h-full">
      <body className="h-full">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
