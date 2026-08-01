import StorefrontLiveCatalogSection from '@/components/catalog/storefront-live-catalog-section';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { denaldSolutions } from '@/data/denald-store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shop Equipment | DENALD',
  description:
    'Browse solar, CCTV, computer and networking equipment from DENALD.',
};

export default function DenaldShopPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#071a31] px-5 py-16 text-white md:py-24">
        <div className="absolute right-[-90px] top-[-100px] h-80 w-80 rounded-full bg-[#1667a4]/22 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-80px] h-72 w-72 rounded-full bg-[#f4c642]/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/ng/denald"
            className="inline-flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#f4c642]"
          >
            <ArrowLeft size={14} />
            Back to DENALD
          </Link>

          <p className="mt-12 text-[9px] font-extrabold uppercase tracking-[0.27em] text-[#62b8ea]">
            DENALD equipment catalogue
          </p>

          <h1 className="mt-5 max-w-4xl font-display text-6xl font-semibold leading-[0.9] tracking-[-0.04em] sm:text-7xl">
            Solar, security and
            <br />
            technology equipment.
          </h1>

          <p className="mt-7 max-w-2xl text-sm leading-8 text-white/60 md:text-base">
            Browse current DENALD equipment in Nigerian naira. Product
            availability, specifications and installation pricing are
            confirmed through the managed DENALD catalogue.
          </p>

          <div className="mt-9 flex flex-wrap gap-2">
            {denaldSolutions.map((solution) => (
              <span
                key={solution.name}
                className="border border-white/15 bg-white/[0.04] px-4 py-3 text-[8px] font-extrabold uppercase tracking-[0.15em] text-white/68"
              >
                {solution.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <StorefrontLiveCatalogSection storefrontCode="DEN" />

      <section className="bg-[#071a31] px-5 py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#f4c642]">
              Unsure what equipment you need?
            </p>

            <h2 className="mt-3 font-display text-4xl font-semibold">
              Request an assessment before purchasing.
            </h2>
          </div>

          <a
            href="https://wa.me/2348186710526"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-3 bg-[#f4c642] px-7 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#071a31]"
          >
            <MessageCircle size={16} />
            Speak with DENALD
          </a>
        </div>
      </section>
</>
  );
}
