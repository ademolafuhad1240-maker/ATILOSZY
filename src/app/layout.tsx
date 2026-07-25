import type { Metadata } from 'next';
import { STORE_CONFIG } from '@/config/store';
import '@/app/globals.css';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import AnnouncementBar from '@/components/layout/announcement-bar';
import CartProvider from '@/components/cart/cart-provider';

const metadata: Metadata = {
  metadataBase: new URL(STORE_CONFIG.productionDomain),
  title: {
    default: 'ATILOSZY — A SORVYRA Brand',
    template: '%s | ATILOSZY',
  },
  description:
    'Discover useful, beautiful and carefully selected products for everyday life—all in one trusted store.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: STORE_CONFIG.productionDomain,
    siteName: 'ATILOSZY',
    title: 'ATILOSZY — A SORVYRA Brand',
    description:
      'Discover useful, beautiful and carefully selected products for everyday life—all in one trusted store.',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export { metadata };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0B3B2E" />
      </head>
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
