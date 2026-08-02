import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileBottomNav } from '@/components/ui/MobileBottomNav'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'MSK Upper Quadrant Reference | HSC Northern Ireland',
    template: '%s | MSK Upper Quadrant Reference',
  },
  description:
    'Evidence-based clinical reference for musculoskeletal upper quadrant conditions. Designed for physiotherapists and allied health professionals in HSC Northern Ireland.',
  keywords: [
    'physiotherapy', 'MSK', 'musculoskeletal', 'upper quadrant',
    'HSC Northern Ireland', 'clinical reference', 'special tests',
    'cervical spine', 'shoulder', 'elbow', 'wrist',
  ],
  authors: [{ name: 'HSC NI Allied Health Professionals' }],
  creator: 'HSC Northern Ireland',
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    title: 'MSK Upper Quadrant Reference',
    description: 'Evidence-based clinical reference for physiotherapists — HSC Northern Ireland',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f172a' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <a href="#main-content" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-teal-300 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg transition focus:translate-y-0">
          Skip to main content
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          <main id="main-content" tabIndex={-1} className="flex-1 pb-14 outline-none lg:pb-0">
            {children}
          </main>
          <Footer />
          <MobileBottomNav />
        </ThemeProvider>
      </body>
    </html>
  )
}
