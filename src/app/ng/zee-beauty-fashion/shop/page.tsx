import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  MessageCircle,
  PackageCheck,
  Truck,
} from 'lucide-react';
import ZeeProductCard from '@/components/zee-nigeria/zee-product-card';
import { zeeNigeriaProducts } from '@/data/zee-nigeria-store';

export const metadata: Metadata = {
  title: 'Shop All | ZEE Beauty & Fashion World',
  description:
    'Browse beauty, fashion, haircare, skincare, fragrance and personal-care products from ZEE Beauty & Fashion World Nigeria.',
};

const departments = [
  'All products',
  'Skincare',
  'Haircare',
  'Makeup',
  'Fragrances',
  'Fashion',
  'Personal Care',
  'Accessories',
];

export default function ZeeNigeriaShopPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#4a102f] px-5 py-16 text-white md:py-24">
        <div className="absolute right-[-80px] top-[-100px] h-80 w-80 rounded-full bg-[#efb7cd]/15 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-80px] h-72 w-72 rounded-full bg-[#f8e3dc]/8 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/ng/zee-beauty-fashion"
            className="inline-flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#f2bed2]"
          >
            <ArrowLeft size={14} />
            Back to ZEE
          </Link>

          <p className="mt-12 text-[9px] font-extrabold uppercase tracking-[0.27em] text-[#f2bed2]">
            ZEE Beauty & Fashion World Nigeria
          </p>

          <h1 className="mt-5 max-w-4xl font-display text-6xl font-semibold leading-[0.9] tracking-[-0.04em] sm:text-7xl">
            Shop beauty, fashion
            <br />
            and everyday care.
          </h1>

          <p className="mt-7 max-w-2xl text-sm leading-8 text-white/62 md:text-base">
            Explore the complete ZEE Nigeria collection. All prices are shown
            in Nigerian naira, with pickup in Osogbo and delivery options
            available.
          </p>

          <div className="mt-9 flex flex-wrap gap-2">
            {departments.map((department) => (
              <span
                key={department}
                className="border border-white/15 bg-white/[0.04] px-4 py-3 text-[8px] font-extrabold uppercase tracking-[0.15em] text-white/68"
              >
                {department}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#fff8f5] px-5 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#99506f]">
                Complete collection
              </p>

              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] text-[#3b1024] sm:text-6xl">
                Shop all ZEE products.
              </h2>
            </div>

            <p className="max-w-md text-sm leading-7 text-[#765463]">
              These are temporary demonstration products. The real catalogue
              will be managed separately through the ZEE admin account.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-5 gap-y-12">
            {zeeNigeriaProducts.map((product) => (
              <ZeeProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#3d1028] px-5 py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          <div className="flex items-center gap-4">
            <PackageCheck size={24} className="text-[#f0b7cd]" />
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em]">
                Osogbo pickup
              </p>
              <p className="mt-1 text-xs text-white/48">
                Reserve and collect from the store
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Truck size={24} className="text-[#f0b7cd]" />
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
            href="https://wa.me/2349159894953"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4"
          >
            <MessageCircle size={24} className="text-[#f0b7cd]" />
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em]">
                Direct support
              </p>
              <p className="mt-1 text-xs text-white/48">
                Message the ZEE team
              </p>
            </div>
          </a>
        </div>
      </section>
    </>
  );
}
