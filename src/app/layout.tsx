import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';
import AnnouncementBar from '@/components/layout/announcement-bar';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import CartProvider from '@/components/cart/cart-provider';
import LivingMotion from '@/components/motion/living-motion';

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
  themeColor: '#050a13',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://shop.sorvyra.com'),
  title: {
    default: 'SORVYRA STORE — Nigeria & Qatar',
    template: '%s | SORVYRA STORE',
  },
  description:
    'The official shopping and services platform for ATILOSZY, ZEE and DENALD across Nigeria and Qatar.',
  openGraph: {
    title: 'SORVYRA STORE',
    description:
      'Shop owned SORVYRA businesses across Nigeria and Qatar.',
    type: 'website',
    siteName: 'SORVYRA STORE',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <CartProvider>
          <LivingMotion />
          <AnnouncementBar />
          <Header />
          <main>{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
