'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Menu, Search, X } from 'lucide-react';
import Container from '@/components/ui/container';

const navigation = [
  { href: '/', label: 'All Stores' },
  { href: '/ng', label: 'Nigeria' },
  { href: '/qa', label: 'Qatar' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-[#f8f6f0]/95 backdrop-blur-xl">
      <Container>
        <div className="flex h-[84px] items-center justify-between">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-[#07172b] shadow-[0_8px_30px_rgba(3,18,38,0.16)]">
              <Image
                src="/brand/sorvyra-store-logo.png"
                alt=""
                fill
                sizes="56px"
                className="scale-[1.62] object-cover object-[50%_24%]"
              />
            </div>

            <div className="min-w-0">
              <span className="block truncate text-[18px] font-extrabold tracking-[0.1em] text-[#091421] sm:text-[21px]">
                SORVYRA
              </span>
              <span className="block text-[8px] font-bold uppercase tracking-[0.38em] text-[#aa8739]">
                Store
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-9 lg:flex" aria-label="Primary navigation">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2d3538] transition hover:text-[#a17d32]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Search all stores"
              className="grid h-11 w-11 place-items-center transition hover:bg-black/5"
            >
              <Search size={19} strokeWidth={1.6} />
            </button>

            <Link
              href="/ng"
              className="hidden min-h-11 items-center gap-2 border border-black/12 px-4 text-[9px] font-bold uppercase tracking-[0.15em] sm:inline-flex"
            >
              Nigeria
              <ChevronDown size={14} />
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

        {mobileOpen && (
          <nav className="border-t border-black/10 py-4 lg:hidden" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block border-b border-black/5 py-4 text-xs font-bold uppercase tracking-[0.16em]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </Container>
    </header>
  );
}
