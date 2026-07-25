'use client';

import { useState } from 'react';
import Link from 'next/link';
import Container from '@/components/ui/container';
import { Menu, X, Search, ShoppingCart } from 'lucide-react';
import { useCart } from '@/components/cart/cart-provider';

const navLinks = [
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { items } = useCart();

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="border-b border-border-color bg-cream-off sticky top-0 z-40">
      <Container>
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold text-charcoal">ATILOSZY</h1>
              <span className="text-xs text-text-muted">A SORVYRA Brand</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-charcoal hover:text-emerald-rich transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            <button
              className="p-2 hover:bg-cream-warm rounded-sm transition-colors"
              aria-label="Search"
            >
              <Search size={20} className="text-charcoal" />
            </button>
            <Link
              href="/cart"
              className="p-2 hover:bg-cream-warm rounded-sm transition-colors relative"
              aria-label="Shopping cart"
            >
              <ShoppingCart size={20} className="text-charcoal" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gold-warm text-charcoal text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 hover:bg-cream-warm rounded-sm transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X size={20} className="text-charcoal" />
              ) : (
                <Menu size={20} className="text-charcoal" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-charcoal hover:text-emerald-rich py-2 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
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
