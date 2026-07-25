'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, Search, ShoppingBag, X } from 'lucide-react';
import Container from '@/components/ui/container';
import { useCart } from '@/components/cart/cart-provider';

const navLinks = [
  { href: '/shop', label: 'Shop All' },
  { href: '/shop', label: 'New Arrivals' },
  { href: '/about', label: 'Our Story' },
  { href: '/contact', label: 'Contact' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { items } = useCart();

  const itemCount = items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-[#fbf8f1]/95 backdrop-blur-xl">
      <Container>
        <div className="flex h-[82px] items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-black shadow-[0_0_24px_rgba(211,176,102,0.18)]">
              <Image
                src="/brand/atiloszy-logo-original.png"
                alt=""
                fill
                sizes="48px"
                className="scale-[2.2] object-cover object-[50%_34%]"
              />
            </div>

            <div>
              <span className="block font-display text-[29px] font-semibold leading-none tracking-[0.05em] text-[#132019]">
                ATILOSZY
              </span>
              <span className="mt-1 block text-[8px] font-extrabold uppercase tracking-[0.32em] text-[#9a7838]">
                Varieties Store
              </span>
            </div>
          </Link>

          <nav
            className="hidden items-center gap-9 lg:flex"
            aria-label="Primary navigation"
          >
            {navLinks.map((link, index) => (
              <Link
                key={`${link.href}-${index}`}
                href={link.href}
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#363933] transition-colors hover:text-[#a27e38]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Search products"
              className="grid h-11 w-11 place-items-center transition hover:bg-black/5"
            >
              <Search size={19} strokeWidth={1.6} />
            </button>

            <Link
              href="/cart"
              aria-label={`Shopping bag with ${itemCount} items`}
              className="relative grid h-11 w-11 place-items-center transition hover:bg-black/5"
            >
              <ShoppingBag size={20} strokeWidth={1.6} />

              {itemCount > 0 && (
                <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-[#0c3124] px-1 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              className="grid h-11 w-11 place-items-center lg:hidden"
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            className="border-t border-black/10 py-5 lg:hidden"
            aria-label="Mobile navigation"
          >
            {navLinks.map((link, index) => (
              <Link
                key={`${link.href}-mobile-${index}`}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block border-b border-black/5 py-4 text-xs font-bold uppercase tracking-[0.16em]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </Container>
    </header>
  );
}
