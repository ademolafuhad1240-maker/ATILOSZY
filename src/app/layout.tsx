import type { Metadata } from 'next';
import './globals.css';
import AnnouncementBar from '@/components/layout/announcement-bar';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import CartProvider from '@/components/cart/cart-provider';

export const metadata: Metadata = {
  title: {
    default: 'ATILOSZY - Everyday finds, thoughtfully chosen',
    template: '%s | ATILOSZY',
  },
  description:
    'Discover useful, beautiful and carefully selected products that add value to your daily life. Shop ATILOSZY, a SORVYRA Brand.',
  keywords: [
    'shopping',
    'curated products',
    'home goods',
    'kitchen',
    'wellness',
    'gifts',
  ],
  openGraph: {
    title: 'ATILOSZY - Everyday finds, thoughtfully chosen',
    description:
      'Discover useful, beautiful and carefully selected products that add value to your daily life.',
    type: 'website',
  },
  robots: 'index, follow',
  viewport: 'width=device-width, initial-scale=1.0',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-cream-off text-charcoal">
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
