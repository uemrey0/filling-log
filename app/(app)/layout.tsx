import { Navigation } from '@/components/layout/Navigation'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col md:h-full md:flex-row">
      <Navigation />
      <main className="mobile-bottom-nav-spacer flex-1 overflow-y-auto md:pb-0">
        <div className="min-h-full px-4 py-5 md:px-8 md:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1240px]">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
