'use client'

import { Sidebar } from './sidebar'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-off-white dark:bg-dark-gray">
      <Sidebar />
      <main className="flex-1 lg:ml-72">
        <div className="p-6 lg:p-10">{children}</div>
      </main>
    </div>
  )
}
