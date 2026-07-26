import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  MessageCircle,
  PackageCheck,
  Truck,
} from 'lucide-react';
import ComfortProductCard from '@/components/zee-comfort/comfort-product-card';
import {
  comfortCategories,
  comfortProducts,
} from '@/data/zee-comfort-store';

export const metadata: Metadata = {
  title: 'Shop All | Zee COMFORT HUB',
  description:
    'Browse sleepwear, leggings, bras, loungewear and everyday comfort essentials from Zee COMFORT HUB Qatar.',
};

export default function ComfortShopPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#401326] px-5 py-16 text-white md:py-24">
        <div className="absolute right-[-90px] top-[-100px] h-80 w-80 rounded-full bg-[#efc4ce]/18 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-80px] h-72 w-72 rounded-full bg-[#f8e7e4]/8 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/qa/zee-comfort-hub"
            className="inline-flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#efc4ce]"
          >
            <ArrowLeft size={14} />
            Back to Zee COMFORT HUB
          </Link>

          <p className="mt-12 text-[9px] font-extrabold uppercase tracking-[0.27em] text-[#efc4ce]">
            Complete Qatar collection
          </p>

          <h1 className="mt-5 max-w-4xl font-display text-6xl font-semibold leading-[0.9] tracking-[-0.04em] sm:text-7xl">
            Shop comfort for
            <br />
            every part of your day.
          </h1>

          <p className="mt-7 max-w-2xl text-sm leading-8 text-white/62 md:text-base">
            Browse sleepwear, leggings, loungewear, bras, shirts, vintage
            clothing and everyday essentials. All prices are displayed in QAR.
          </p>

          <div className="mt-9 flex flex-wrap gap-2">
            {comfortCategories.map((category) => (
              <a
                key={category.name}
                href="#products"
                className="border border-white/15 bg-white/[0.04] px-4 py-3 text-[8px] font-extrabold uppercase tracking-[0.15em] text-white/68 transition hover:border-[#efc4ce] hover:text-[#efc4ce]"
              >
                {category.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="products" className="bg-[#fff9f7] px-5 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#9b5a6d]">
                Complete collection
              </p>

              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] text-[#481428] sm:text-6xl">
                Shop Zee COMFORT HUB.
              </h2>
            </div>

            <p className="max-w-md text-sm leading-7 text-[#7d5a65]">
              These are temporary demonstration products. The real inventory,
              sizes and availability will be managed through the store admin.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-5 gap-y-12">
            {comfortProducts.map((product) => (
              <ComfortProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#481428] px-5 py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          <div className="flex items-center gap-4">
            <PackageCheck size={24} className="text-[#efc4ce]" />

            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em]">
                Doha pickup
              </p>

              <p className="mt-1 text-xs text-white/48">
                Reserve and arrange store collection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Truck size={24} className="text-[#efc4ce]" />

            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em]">
                Qatar delivery
              </p>

              <p className="mt-1 text-xs text-white/48">
                Delivery available throughout Qatar
              </p>
            </div>
          </div>

          <a
            href="https://wa.me/97430975465"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4"
          >
            <MessageCircle size={24} className="text-[#efc4ce]" />

            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em]">
                Direct support
              </p>

              <p className="mt-1 text-xs text-white/48">
                Message the Zee COMFORT HUB team
              </p>
            </div>
          </a>
        </div>
      </section>
    </>
  );
}
