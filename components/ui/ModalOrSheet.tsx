'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Drawer } from 'vaul'

interface ModalOrSheetProps {
  open: boolean
  onClose?: () => void
  children: React.ReactNode
  footer?: React.ReactNode
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

function useKeyboardInset(enabled: boolean) {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const check = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setHeight(inset > 80 ? inset : 0)
    }
    check()
    vv.addEventListener('resize', check)
    vv.addEventListener('scroll', check)
    return () => {
      vv.removeEventListener('resize', check)
      vv.removeEventListener('scroll', check)
    }
  }, [enabled])
  return height
}

export function ModalOrSheet({ open, onClose, children, footer }: ModalOrSheetProps) {
  const isDesktop = useIsDesktop()
  const keyboardInset = useKeyboardInset(open && !isDesktop)
  const keyboardOpen = keyboardInset > 0

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
        repositionInputs={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90dvh] w-[100vw] max-w-[100vw] flex-col overflow-hidden rounded-t-3xl bg-white outline-none">
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
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
              style={{
                padding: '1.25rem',
                paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
              }}
            >
              {children}
            </div>
            {footer ? (
              <div
                className={`shrink-0 overflow-hidden border-gray-100 bg-white transition-[max-height,opacity,padding,border-top-width] duration-200 ease-out ${
                  keyboardOpen
                    ? 'max-h-0 border-t-0 px-4 pt-0 opacity-0'
                    : 'max-h-40 border-t px-4 pt-3 opacity-100'
                }`}
                style={{
                  paddingBottom: keyboardOpen ? 0 : 'max(1rem, env(safe-area-inset-bottom))',
                }}
                aria-hidden={keyboardOpen}
              >
                {footer}
              </div>
            ) : null}
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
          className="min-h-0 overflow-y-auto overflow-x-hidden flex-1"
          style={{ padding: '1.25rem' }}
        >
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-gray-100 bg-white p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
