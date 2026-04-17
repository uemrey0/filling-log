import { Navigation } from '@/components/layout/Navigation'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <Navigation />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-3xl mx-auto px-4 py-5">{children}</div>
      </main>
    </div>
  )
}
