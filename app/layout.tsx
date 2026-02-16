import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers/session-provider'

export const metadata: Metadata = {
  title: 'AMI One-on-One',
  description: 'One-on-One Meeting Management System',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AMI 1:1',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#333333" media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
