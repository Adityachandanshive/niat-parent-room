import type { Metadata, Viewport } from 'next'
import { Noto_Sans } from 'next/font/google'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

const notoSans = Noto_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans',
})

export const metadata: Metadata = {
  title: 'NIAT Parent Decision Room',
  description:
    "Helping parents make informed decisions about their child's education at NIAT.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${notoSans.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
