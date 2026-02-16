'use client'

import { Sidebar } from './sidebar'
import { ToastProvider } from '@/components/ui/toast'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-0 bg-off-white dark:bg-dark-gray">
        <Sidebar />
        <main className="flex-1 min-w-0 lg:ml-72">
          {/* pb-20 on mobile gives space above the bottom tab bar */}
          <div className="px-4 py-4 pb-24 lg:px-10 lg:py-10 lg:pb-10">{children}</div>
        </main>
      </div>
    </ToastProvider>
  )
}
