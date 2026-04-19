'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Drawer } from 'vaul'

interface ModalOrSheetProps {
  open: boolean
  onClose?: () => void
  children: React.ReactNode
}

const DESKTOP_QUERY = '(min-width: 768px)'

function subscribe(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(DESKTOP_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function getSnapshot() {
  return typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches
}

function getServerSnapshot() {
  return false
}

function useIsDesktop() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function ModalOrSheet({ open, onClose, children }: ModalOrSheetProps) {
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!isDesktop) return
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open, isDesktop])

  useEffect(() => {
    if (!isDesktop || !open || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, isDesktop])

  if (!isDesktop) {
    return (
      <Drawer.Root
        open={open}
        onOpenChange={(v) => {
          if (!v) onClose?.()
        }}
        shouldScaleBackground={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white rounded-t-3xl outline-none max-h-[90dvh]">
            <Drawer.Handle className="mt-3 mb-1 w-10! h-1! bg-gray-300!" />
            <Drawer.Title
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              Dialog
            </Drawer.Title>
            <div
              className="overflow-y-auto flex-1"
              style={{
                padding: '1.25rem',
                paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
              }}
            >
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90dvh' }}
      >
        <div
          className="overflow-y-auto flex-1"
          style={{ padding: '1.25rem' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
