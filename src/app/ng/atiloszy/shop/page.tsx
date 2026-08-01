import StorefrontLiveCatalogSection from '@/components/catalog/storefront-live-catalog-section';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  PackageCheck,
  Truck,
} from 'lucide-react';
import { atiloszyCategories } from '@/data/atiloszy-store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shop All | ATILOSZY Varieties Store',
  description:
    'Browse footwear, home products, kitchen essentials, gadgets, accessories and everyday products from ATILOSZY.',
};

export default function AtiloszyShopPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#03130c] px-5 py-16 text-white md:py-24">
        <div className="absolute right-[-90px] top-[-100px] h-80 w-80 rounded-full bg-[#17a665]/18 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-80px] h-72 w-72 rounded-full bg-[#d8bd69]/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/ng/atiloszy"
            className="inline-flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#d8bd69]"
          >
            <ArrowLeft size={14} />
            Back to ATILOSZY
          </Link>

          <p className="mt-12 text-[9px] font-extrabold uppercase tracking-[0.27em] text-[#55c989]">
            ATILOSZY complete catalogue
          </p>

          <h1 className="mt-5 max-w-4xl font-display text-6xl font-semibold leading-[0.9] tracking-[-0.04em] sm:text-7xl">
            Shop everyday variety,
            <br />
            all in one place.
          </h1>

          <p className="mt-7 max-w-2xl text-sm leading-8 text-white/60 md:text-base">
            Browse footwear, home and kitchen essentials, gadgets, accessories,
            gifts and practical everyday products. Prices are displayed in
            Nigerian naira.
          </p>

          <div className="mt-9 flex flex-wrap gap-2">
            {atiloszyCategories.map((category) => (
              <a
                key={category.name}
                href="#products"
                className="border border-white/15 bg-white/[0.04] px-4 py-3 text-[8px] font-extrabold uppercase tracking-[0.15em] text-white/68 transition hover:border-[#d8bd69] hover:text-[#d8bd69]"
              >
                {category.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      <StorefrontLiveCatalogSection storefrontCode="ATI" />

      <section className="bg-[#062317] px-5 py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          <div className="flex items-center gap-4">
            <PackageCheck size={24} className="text-[#d8bd69]" />

            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em]">
                Osogbo pickup
              </p>

              <p className="mt-1 text-xs text-white/48">
                Reserve and collect from ATILOSZY
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Truck size={24} className="text-[#55c989]" />

            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em]">
                Delivery available
              </p>

              <p className="mt-1 text-xs text-white/48">
                Osogbo and nationwide options
              </p>
            </div>
          </div>

          <a
            href="https://wa.me/2347074417879"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4"
          >
            <MessageCircle size={24} className="text-[#d8bd69]" />

            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em]">
                Direct support
              </p>

              <p className="mt-1 text-xs text-white/48">
                Message the ATILOSZY team
              </p>
            </div>

            <ArrowRight size={15} className="ml-auto" />
          </a>
        </div>
      </section>
</>
  );
}
