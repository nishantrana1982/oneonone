'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
  toastSuccess: (message: string) => void
  toastError: (message: string) => void
  toastWarning: (message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback if used outside provider -- won't crash
    return {
      toast: (message: string) => console.warn('[Toast]', message),
      toastSuccess: (message: string) => console.warn('[Toast success]', message),
      toastError: (message: string) => console.error('[Toast error]', message),
      toastWarning: (message: string) => console.warn('[Toast warning]', message),
    }
  }
  return ctx
}

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const styles: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-blue-600 text-white',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setToasts((prev) => [...prev, { id, type, message }])
      setTimeout(() => removeToast(id), 4000)
    },
    [removeToast]
  )

  const value: ToastContextType = {
    toast: addToast,
    toastSuccess: useCallback((msg: string) => addToast(msg, 'success'), [addToast]),
    toastError: useCallback((msg: string) => addToast(msg, 'error'), [addToast]),
    toastWarning: useCallback((msg: string) => addToast(msg, 'warning'), [addToast]),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container */}
      <div role="status" aria-live="polite" className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none max-w-[90vw] sm:max-w-md">
        {toasts.map((t) => {
          const Icon = icons[t.type]
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-right-5 fade-in-0 duration-300',
                styles[t.type]
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium flex-1">{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
                className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
