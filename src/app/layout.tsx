import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';
import AnnouncementBar from '@/components/layout/announcement-bar';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import CartProvider from '@/components/cart/cart-provider';

const displayFont = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b2a20',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://atiloszy.sorvyra.com'),
  title: {
    default: 'ATILOSZY — Thoughtfully Chosen',
    template: '%s | ATILOSZY',
  },
  description:
    'A premium Nigerian variety store offering thoughtfully selected products for modern everyday living.',
  openGraph: {
    title: 'ATILOSZY — Thoughtfully Chosen',
    description:
      'Useful, beautiful and carefully selected products for modern everyday living.',
    type: 'website',
    siteName: 'ATILOSZY',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-NG" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <CartProvider>
          <AnnouncementBar />
          <Header />
          <main>{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
