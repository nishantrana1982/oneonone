'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

// ── Types ───────────────────────────────────────────────────────────

type ConfirmVariant = 'danger' | 'default'

interface ConfirmOptions {
  title?: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>

// ── Context ─────────────────────────────────────────────────────────

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext)
  if (!fn) {
    return async () => {
      console.warn('[Confirm] useConfirm used outside ConfirmProvider — returning false')
      return false
    }
  }
  return fn
}

// ── Provider ────────────────────────────────────────────────────────

interface ModalState {
  message: string
  title: string
  confirmText: string
  cancelText: string
  variant: ConfirmVariant
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const confirm: ConfirmFn = useCallback((message, options = {}) => {
    return new Promise<boolean>((resolve) => {
      setModal({
        message,
        title: options.title ?? 'Are you sure?',
        confirmText: options.confirmText ?? 'Confirm',
        cancelText: options.cancelText ?? 'Cancel',
        variant: options.variant ?? 'default',
        resolve,
      })
    })
  }, [])

  const close = useCallback(
    (result: boolean) => {
      modal?.resolve(result)
      setModal(null)
    },
    [modal]
  )

  // Escape key handler
  useEffect(() => {
    if (!modal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [modal, close])

  // Click-outside handler
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) close(false)
    },
    [close]
  )

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {/* Modal overlay */}
      {modal && (
        <div
          ref={backdropRef}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 animate-in fade-in-0 duration-200"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            className="w-full max-w-md bg-white dark:bg-charcoal rounded-2xl shadow-card p-6 sm:p-8 animate-in zoom-in-95 fade-in-0 duration-200"
          >
            <h2
              id="confirm-title"
              className="text-lg font-semibold text-charcoal dark:text-white"
            >
              {modal.title}
            </h2>

            <p
              id="confirm-message"
              className="mt-2 text-sm text-medium-gray dark:text-light-gray leading-relaxed"
            >
              {modal.message}
            </p>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button
                onClick={() => close(false)}
                className="px-4 py-2.5 text-sm font-medium rounded-xl border border-light-gray/30 dark:border-medium-gray/30 text-charcoal dark:text-white bg-transparent hover:bg-off-white dark:hover:bg-dark-gray transition-colors duration-200"
              >
                {modal.cancelText}
              </button>

              <button
                onClick={() => close(true)}
                className={cn(
                  'px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-colors duration-200',
                  modal.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-orange hover:bg-orange-hover'
                )}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
