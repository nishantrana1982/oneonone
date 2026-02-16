'use client'

import { Sidebar } from './sidebar'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 bg-off-white dark:bg-dark-gray">
      <Sidebar />
      <main className="flex-1 min-w-0 lg:ml-72">
        <div className="p-6 lg:p-10">{children}</div>
      </main>
    </div>
  )
}
