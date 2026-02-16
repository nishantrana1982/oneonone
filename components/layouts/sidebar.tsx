'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ChevronRight,
  BarChart3,
  UserCircle,
  Building2,
  Shield,
  HardDrive,
  Mic,
} from 'lucide-react'
import { useState } from 'react'
import { UserRole } from '@prisma/client'
import { useTheme } from './theme-provider'
import { NotificationCenter } from '@/components/notifications/notification-center'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Meetings', href: '/meetings', icon: Calendar },
  { name: 'To-Dos', href: '/todos', icon: CheckSquare },
  { name: 'Team', href: '/employees', icon: Users, roles: ['REPORTER', 'SUPER_ADMIN'] },
  { name: 'Reports', href: '/reports', icon: FileText, roles: ['REPORTER', 'SUPER_ADMIN'] },
  { name: 'Insights', href: '/insights', icon: BarChart3, roles: ['REPORTER', 'SUPER_ADMIN'] },
]

const adminNavigation = [
  { name: 'User Management', href: '/admin', icon: Users },
  { name: 'Departments', href: '/admin/departments', icon: Building2 },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: Shield },
  { name: 'Backup & Restore', href: '/admin/backup', icon: HardDrive },
  { name: 'Recording Storage', href: '/admin/storage', icon: Mic },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
]

// Bottom tab bar items (mobile only — max 5 for thumb reach)
const bottomTabs = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Meetings', href: '/meetings', icon: Calendar },
  { name: 'Tasks', href: '/todos', icon: CheckSquare },
  { name: 'Reports', href: '/reports', icon: FileText, roles: ['REPORTER', 'SUPER_ADMIN'] },
  { name: 'More', href: '__more__', icon: Menu },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const userRole = session?.user?.role
  const isAdmin = userRole === UserRole.SUPER_ADMIN
  const isReporter = userRole === UserRole.REPORTER || isAdmin

  const filteredNavigation = navigation.filter((item) => {
    if (!item.roles) return true
    return item.roles.includes(userRole as string)
  })

  const filteredBottomTabs = bottomTabs.filter((item) => {
    if (!item.roles) return true
    return item.roles.includes(userRole as string)
  })

  const handleTabClick = (href: string) => {
    if (href === '__more__') {
      setIsMobileOpen(true)
    }
  }

  return (
    <>
      {/* ================================================================
          MOBILE: Bottom Tab Bar (visible below lg breakpoint)
          ================================================================ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-charcoal border-t border-off-white dark:border-medium-gray/20 safe-area-bottom">
        <div className="flex items-stretch justify-around h-16">
          {filteredBottomTabs.map((tab) => {
            const isMore = tab.href === '__more__'
            const isActive = !isMore && (pathname === tab.href || pathname?.startsWith(tab.href + '/'))

            if (isMore) {
              return (
                <button
                  key={tab.name}
                  onClick={() => handleTabClick(tab.href)}
                  className="flex flex-col items-center justify-center flex-1 gap-0.5 text-medium-gray active:bg-off-white/60 dark:active:bg-dark-gray/60 transition-colors"
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{tab.name}</span>
                </button>
              )
            }

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors active:bg-off-white/60 dark:active:bg-dark-gray/60',
                  isActive ? 'text-orange' : 'text-medium-gray'
                )}
              >
                <tab.icon className={cn('w-5 h-5', isActive && 'text-orange')} />
                <span className={cn('text-[10px] font-medium', isActive && 'text-orange')}>
                  {tab.name}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ================================================================
          MOBILE: Slide-over panel ("More" menu)
          ================================================================ */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-[70] w-[85vw] max-w-sm bg-white dark:bg-charcoal shadow-2xl transform transition-transform duration-300 ease-out lg:hidden flex flex-col',
          isMobileOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Mobile panel header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-off-white dark:border-dark-gray">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-dark-gray dark:bg-white/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="font-bold text-dark-gray dark:text-white">AMI One-on-One</span>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-off-white dark:hover:bg-dark-gray"
          >
            <X className="w-5 h-5 text-dark-gray dark:text-white" />
          </button>
        </div>

        {/* Mobile nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="mb-2 px-3">
            <span className="text-xs font-semibold text-medium-gray uppercase tracking-wider">Menu</span>
          </div>
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-off-white dark:bg-dark-gray text-dark-gray dark:text-white'
                    : 'text-medium-gray active:bg-off-white/50 dark:active:bg-dark-gray/50'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'text-orange')} />
                <span className="flex-1">{item.name}</span>
                {isActive && <ChevronRight className="h-4 w-4 text-orange" />}
              </Link>
            )
          })}

          {isAdmin && (
            <>
              <div className="mt-6 mb-2 px-3">
                <span className="text-xs font-semibold text-medium-gray uppercase tracking-wider">Admin</span>
              </div>
              {adminNavigation.map((item) => {
                const isActive = item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname === item.href || pathname?.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-off-white dark:bg-dark-gray text-dark-gray dark:text-white'
                        : 'text-medium-gray active:bg-off-white/50 dark:active:bg-dark-gray/50'
                    )}
                  >
                    <item.icon className={cn('h-5 w-5', isActive && 'text-orange')} />
                    <span className="flex-1">{item.name}</span>
                    {isActive && <ChevronRight className="h-4 w-4 text-orange" />}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Mobile panel footer */}
        <div className="p-4 border-t border-off-white dark:border-dark-gray space-y-3">
          <div className="flex items-center justify-between px-2">
            <NotificationCenter />
            <button
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-off-white dark:hover:bg-dark-gray transition-colors"
              title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            >
              {theme === 'light' ? <Moon className="h-5 w-5 text-medium-gray" /> : <Sun className="h-5 w-5 text-medium-gray" />}
            </button>
          </div>

          <Link
            href="/profile"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-off-white dark:bg-dark-gray"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-charcoal to-medium-gray dark:from-medium-gray dark:to-charcoal flex items-center justify-center text-white font-semibold">
              {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-gray dark:text-white truncate">
                {session?.user?.name}
              </p>
              <p className="text-xs text-medium-gray truncate capitalize">
                {session?.user?.role?.toLowerCase().replace('_', ' ')}
              </p>
            </div>
            <UserCircle className="w-4 h-4 text-medium-gray" />
          </Link>

          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ================================================================
          DESKTOP: Traditional left sidebar (visible at lg+)
          ================================================================ */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-charcoal border-r border-off-white dark:border-dark-gray flex-col">
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-off-white dark:border-dark-gray">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-dark-gray dark:bg-white/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark-gray dark:text-white">AMI</h1>
              <p className="text-xs text-medium-gray -mt-0.5">One-on-One</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="mb-2 px-3">
            <span className="text-xs font-semibold text-medium-gray uppercase tracking-wider">Menu</span>
          </div>
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 group relative',
                  isActive
                    ? 'bg-off-white dark:bg-dark-gray text-dark-gray dark:text-white'
                    : 'text-medium-gray hover:bg-off-white/50 dark:hover:bg-dark-gray/50 hover:text-dark-gray dark:hover:text-white'
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-orange rounded-r-full" />
                )}
                <item.icon className={cn('h-5 w-5', isActive ? 'text-orange' : 'group-hover:text-dark-gray dark:group-hover:text-white')} />
                <span className="flex-1">{item.name}</span>
                {isActive && <ChevronRight className="h-4 w-4 text-orange" />}
              </Link>
            )
          })}

          {isAdmin && (
            <>
              <div className="mt-8 mb-2 px-3">
                <span className="text-xs font-semibold text-medium-gray uppercase tracking-wider">Admin</span>
              </div>
              {adminNavigation.map((item) => {
                const isActive = item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname === item.href || pathname?.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 group relative',
                      isActive
                        ? 'bg-off-white dark:bg-dark-gray text-dark-gray dark:text-white'
                        : 'text-medium-gray hover:bg-off-white/50 dark:hover:bg-dark-gray/50 hover:text-dark-gray dark:hover:text-white'
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-orange rounded-r-full" />
                    )}
                    <item.icon className={cn('h-5 w-5', isActive ? 'text-orange' : 'group-hover:text-dark-gray dark:group-hover:text-white')} />
                    <span className="flex-1">{item.name}</span>
                    {isActive && <ChevronRight className="h-4 w-4 text-orange" />}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-off-white dark:border-dark-gray space-y-3">
          <div className="flex items-center justify-between px-2">
            <NotificationCenter />
            <button
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-off-white dark:hover:bg-dark-gray transition-colors"
              title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            >
              {theme === 'light' ? <Moon className="h-5 w-5 text-medium-gray" /> : <Sun className="h-5 w-5 text-medium-gray" />}
            </button>
          </div>

          <Link
            href="/profile"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-off-white dark:bg-dark-gray hover:bg-off-white/80 dark:hover:bg-dark-gray/80 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-charcoal to-medium-gray dark:from-medium-gray dark:to-charcoal flex items-center justify-center text-white font-semibold">
              {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-gray dark:text-white truncate">
                {session?.user?.name}
              </p>
              <p className="text-xs text-medium-gray truncate capitalize">
                {session?.user?.role?.toLowerCase().replace('_', ' ')}
              </p>
            </div>
            <UserCircle className="w-4 h-4 text-medium-gray" />
          </Link>

          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
