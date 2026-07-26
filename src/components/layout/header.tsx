'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Heart,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react';
import Container from '@/components/ui/container';

const categories = [
  { href: '/', label: 'New & Trending' },
  { href: '/ng/atiloszy', label: 'Shoes & Essentials' },
  { href: '/ng/zee-beauty-fashion', label: 'Beauty & Fashion' },
  { href: '/ng/atiloszy', label: 'Home & Living' },
  { href: '/ng/denald', label: 'Solar & Technology' },
  { href: '/qa/zee-comfort-hub', label: 'Qatar Comfort' },
  { href: '/ng/denald', label: 'Installation Services' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#0a1119] text-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
      <Container>
        <div className="flex min-h-[82px] items-center gap-5 lg:gap-8">
          <Link href="/" className="shrink-0" aria-label="SORVYRA STORE home">
            <span className="block text-[20px] font-extrabold tracking-[0.14em] sm:text-[23px]">
              SORVYRA
            </span>
            <span className="mt-0.5 block text-[7px] font-extrabold uppercase tracking-[0.44em] text-[#d4ad55]">
              Store
            </span>
          </Link>

          <form
            action="/shop"
            className="hidden min-h-12 flex-1 items-center overflow-hidden rounded-full bg-white lg:flex"
          >
            <Search
              size={19}
              className="ml-5 shrink-0 text-[#4c5661]"
              strokeWidth={1.8}
            />
            <input
              type="search"
              name="q"
              aria-label="Search across SORVYRA stores"
              placeholder="Search products, categories and stores"
              className="h-12 min-w-0 flex-1 border-0 bg-transparent px-4 text-sm text-[#111820] outline-none placeholder:text-[#7f8790]"
            />
            <button
              type="submit"
              className="mr-1.5 rounded-full bg-[#0c888c] px-6 py-3 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-[#0a7478]"
            >
              Search
            </button>
          </form>

          <div className="ml-auto flex items-center">
            <Link
              href="/ng"
              className="hidden min-h-11 items-center gap-2 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-white/78 transition hover:text-white md:flex"
            >
              <MapPin size={17} strokeWidth={1.6} />
              Nigeria
              <ChevronDown size={13} />
            </Link>

            <button
              type="button"
              aria-label="Customer account"
              className="hidden h-11 w-11 place-items-center text-white/75 transition hover:text-white sm:grid"
            >
              <UserRound size={20} strokeWidth={1.6} />
            </button>

            <button
              type="button"
              aria-label="Saved products"
              className="hidden h-11 w-11 place-items-center text-white/75 transition hover:text-white sm:grid"
            >
              <Heart size={20} strokeWidth={1.6} />
            </button>

            <Link
              href="/cart"
              aria-label="Choose storefront cart"
              className="relative grid h-11 w-11 place-items-center text-white/80 transition hover:text-white"
            >
              <ShoppingBag size={20} strokeWidth={1.6} />
            </Link>

            <button
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="grid h-11 w-11 place-items-center lg:hidden"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        <form
          action="/shop"
          className="mb-4 flex min-h-12 items-center overflow-hidden rounded-full bg-white lg:hidden"
        >
          <Search
            size={18}
            className="ml-4 shrink-0 text-[#4c5661]"
            strokeWidth={1.8}
          />
          <input
            type="search"
            name="q"
            aria-label="Search across SORVYRA stores"
            placeholder="Search all stores"
            className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm text-[#111820] outline-none"
          />
          <button
            type="submit"
            className="mr-1.5 rounded-full bg-[#0c888c] px-5 py-3 text-[8px] font-extrabold uppercase tracking-[0.14em]"
          >
            Search
          </button>
        </form>
      </Container>

      <div className="border-t border-white/8 bg-[#0d1721]">
        <Container>
          <nav
            className="hide-scrollbar hidden min-h-12 items-center gap-8 overflow-x-auto lg:flex"
            aria-label="Shopping departments"
          >
            {categories.map((category) => (
              <Link
                key={`${category.href}-${category.label}`}
                href={category.href}
                className="shrink-0 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/62 transition hover:text-[#5ed0ca]"
              >
                {category.label}
              </Link>
            ))}
          </nav>

          {mobileOpen && (
            <nav className="grid gap-1 py-4 lg:hidden" aria-label="Mobile shopping departments">
              {categories.map((category) => (
                <Link
                  key={`${category.href}-${category.label}`}
                  href={category.href}
                  onClick={() => setMobileOpen(false)}
                  className="border-b border-white/6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/70"
                >
                  {category.label}
                </Link>
              ))}
            </nav>
          )}
        </Container>
      </div>
    </header>
  );
}
