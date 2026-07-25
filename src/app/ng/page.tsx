import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Clock3,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Truck,
  Zap,
} from 'lucide-react';
import DiscoveryProductCard from '@/components/sorvyra/discovery-product-card';
import NigeriaStorePanel from '@/components/sorvyra/nigeria-store-panel';
import { discoveryProducts } from '@/data/sorvyra-discovery';
import { getStorefront } from '@/data/storefronts';

export const metadata: Metadata = {
  title: 'Shop Nigeria',
  description:
    'Shop ATILOSZY, ZEE Beauty & Fashion World and DENALD across Nigeria.',
};

const atiloszy = getStorefront('atiloszy');
const zee = getStorefront('zee-beauty-fashion');
const denald = getStorefront('denald');

const nigeriaProducts = discoveryProducts.filter(
  (product) => product.currency === 'NGN',
);

const categories = [
  {
    name: 'Shoes',
    href: '/ng/atiloszy',
    image:
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=700&auto=format&fit=crop&q=88',
  },
  {
    name: 'Beauty',
    href: '/ng/zee-beauty-fashion',
    image:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=700&auto=format&fit=crop&q=88',
  },
  {
    name: 'Fashion',
    href: '/ng/zee-beauty-fashion',
    image:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=700&auto=format&fit=crop&q=88',
  },
  {
    name: 'Home Essentials',
    href: '/ng/atiloszy',
    image:
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=700&auto=format&fit=crop&q=88',
  },
  {
    name: 'Solar Power',
    href: '/ng/denald',
    image:
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=700&auto=format&fit=crop&q=88',
  },
  {
    name: 'CCTV & Computers',
    href: '/ng/denald',
    image:
      'https://images.unsplash.com/photo-1558002038-1055907df827?w=700&auto=format&fit=crop&q=88',
  },
];

export default function NigeriaPage() {
  return (
    <>
      <section className="sorvyra-nigeria-hero bg-[#071019] px-5 py-8 text-white md:py-12">
        <div className="mx-auto grid max-w-[1440px] gap-5 lg:grid-cols-[1fr_0.92fr]">
          <div className="relative flex min-h-[570px] flex-col justify-center overflow-hidden border border-white/10 bg-[#0c1822] p-8 sm:p-12 lg:p-16">
            <div className="absolute right-[-100px] top-[-100px] h-80 w-80 rounded-full bg-[#0c888c]/20 blur-3xl" />
            <div className="absolute bottom-[-120px] left-[-80px] h-72 w-72 rounded-full bg-[#d4ad55]/10 blur-3xl" />

            <div className="relative">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.28em] text-[#d4ad55]">
                SORVYRA STORE Nigeria
              </p>

              <h1 className="mt-7 max-w-3xl font-display text-6xl font-semibold leading-[0.88] tracking-[-0.04em] sm:text-7xl">
                Shop Nigeria,
                <br />
                all in one place.
              </h1>

              <p className="mt-8 max-w-xl text-base leading-8 text-white/62">
                Discover everyday products, beauty and fashion, solar power,
                security systems and professional technology services from
                three independently managed SORVYRA businesses.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="#nigeria-stores"
                  className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#d4ad55] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#0a1119]"
                >
                  Explore Nigerian stores
                  <ArrowRight size={16} />
                </Link>

                <Link
                  href="#nigeria-products"
                  className="inline-flex min-h-14 items-center justify-center border border-white/20 px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] transition hover:bg-white hover:text-[#0a1119]"
                >
                  Browse products
                </Link>
              </div>

              <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/10 pt-7">
                <span className="flex items-center gap-2 text-[10px] text-white/58">
                  <Truck size={16} className="text-[#5ed0ca]" />
                  Nationwide delivery
                </span>
                <span className="flex items-center gap-2 text-[10px] text-white/58">
                  <Zap size={16} className="text-[#d4ad55]" />
                  Same-day Osogbo delivery where available
                </span>
                <span className="flex items-center gap-2 text-[10px] text-white/58">
                  <MapPin size={16} className="text-[#5ed0ca]" />
                  Pickup available
                </span>
              </div>
            </div>
          </div>

          <div className="grid min-h-[570px] grid-cols-2 grid-rows-2 gap-4">
            <Link
              href="/ng/atiloszy"
              className="group relative col-span-2 overflow-hidden"
            >
              <Image
                src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1300&auto=format&fit=crop&q=90"
                alt="Shoes and everyday products"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 46vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#d4ad55]">
                  ATILOSZY
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold">
                  Everyday variety, carefully selected.
                </h2>
              </div>
            </Link>

            <Link
              href="/ng/zee-beauty-fashion"
              className="group relative overflow-hidden"
            >
              <Image
                src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&auto=format&fit=crop&q=90"
                alt="Beauty products"
                fill
                sizes="(max-width: 1024px) 50vw, 23vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#3f1029]/95 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#f2bad1]">
                  ZEE
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold">
                  Beauty and fashion.
                </h2>
              </div>
            </Link>

            <Link
              href="/ng/denald"
              className="group relative overflow-hidden"
            >
              <Image
                src="https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=900&auto=format&fit=crop&q=90"
                alt="Solar panels"
                fill
                sizes="(max-width: 1024px) 50vw, 23vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06172d]/95 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#f4c642]">
                  DENALD
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold">
                  Power and technology.
                </h2>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#e7e1d6] px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#765e30]">
                Popular departments
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold text-[#111820] sm:text-5xl">
                What are you shopping for?
              </h2>
            </div>

            <p className="max-w-md text-sm leading-7 text-[#59616a]">
              Browse across all Nigerian SORVYRA businesses while prices remain
              clearly displayed in Nigerian naira.
            </p>
          </div>

          <div className="hide-scrollbar mt-10 flex gap-4 overflow-x-auto pb-4">
            {categories.map((category) => (
              <Link
                key={category.name}
                href={category.href}
                className="group min-w-[170px] flex-1"
              >
                <div className="relative aspect-square overflow-hidden rounded-full bg-[#cbc3b5]">
                  <Image
                    src={category.image}
                    alt=""
                    fill
                    sizes="180px"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-4 text-center text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#111820]">
                  {category.name}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        id="nigeria-stores"
        className="bg-[#0b151f] px-5 py-20 text-white md:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.25em] text-[#5ed0ca]">
            Nigerian storefronts
          </p>

          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-3xl font-display text-5xl font-semibold leading-none sm:text-6xl">
              Three businesses, each with its own identity.
            </h2>

            <p className="max-w-md text-sm leading-7 text-white/50">
              Each store keeps its own catalogue, support, cart, account and
              checkout while operating within SORVYRA STORE.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <NigeriaStorePanel
              storefront={atiloszy}
              image="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1400&auto=format&fit=crop&q=90"
              eyebrow="Varieties store"
              accent="#d4ad55"
              className="lg:col-span-2 min-h-[560px]"
            />

            <NigeriaStorePanel
              storefront={zee}
              image="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&auto=format&fit=crop&q=90"
              eyebrow="Beauty, fashion and care"
              accent="#f2bad1"
            />

            <NigeriaStorePanel
              storefront={denald}
              image="https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=1200&auto=format&fit=crop&q=90"
              eyebrow="Solar, security and technology"
              accent="#f4c642"
              serviceStore
            />
          </div>
        </div>
      </section>

      <section
        id="nigeria-products"
        className="bg-[#eee8de] px-5 py-20 md:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#765e30]">
                Featured in Nigeria
              </p>

              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] text-[#111820] sm:text-6xl">
                Discover products in naira.
              </h2>
            </div>

            <Link
              href="/shop"
              className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#111820]"
            >
              View all products
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="hide-scrollbar mt-12 flex gap-5 overflow-x-auto pb-5">
            {nigeriaProducts.map((product) => (
              <DiscoveryProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#071019] px-5 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
          <div className="relative overflow-hidden border border-white/10 bg-[#0d1a25] p-8 sm:p-10">
            <Truck size={30} className="text-[#5ed0ca]" strokeWidth={1.5} />

            <p className="mt-8 text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#5ed0ca]">
              Delivery and pickup
            </p>

            <h2 className="mt-4 font-display text-4xl font-semibold">
              Flexible fulfilment across Nigeria.
            </h2>

            <p className="mt-5 max-w-xl text-sm leading-7 text-white/55">
              Choose store pickup or request delivery. ATILOSZY and ZEE may
              provide same-day Osogbo delivery where available, while nationwide
              delivery charges are confirmed for each order.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <span className="flex items-center gap-3 text-xs text-white/65">
                <Clock3 size={17} className="text-[#d4ad55]" />
                Open daily, 10 AM–6 PM
              </span>
              <span className="flex items-center gap-3 text-xs text-white/65">
                <MessageCircle size={17} className="text-[#d4ad55]" />
                WhatsApp messages accepted 24 hours
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden bg-[#103254] p-8 sm:p-10">
            <ShieldCheck size={30} className="text-[#f4c642]" strokeWidth={1.5} />

            <p className="mt-8 text-[9px] font-extrabold uppercase tracking-[0.22em] text-[#f4c642]">
              DENALD professional services
            </p>

            <h2 className="mt-4 font-display text-4xl font-semibold">
              Need solar, CCTV or computer installation?
            </h2>

            <p className="mt-5 max-w-xl text-sm leading-7 text-white/62">
              Submit a service request, arrange an inspection where necessary,
              receive a quotation and schedule professional installation or
              maintenance.
            </p>

            <Link
              href="/ng/denald"
              className="mt-8 inline-flex min-h-12 items-center gap-3 bg-[#f4c642] px-6 text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#07172b]"
            >
              Request DENALD service
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#0c888c] px-5 py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-white/65">
              Shopping outside Nigeria?
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              Visit SORVYRA STORE Qatar.
            </h2>
          </div>

          <Link
            href="/qa"
            className="inline-flex min-h-12 items-center justify-center gap-3 bg-[#071019] px-7 text-[9px] font-extrabold uppercase tracking-[0.18em]"
          >
            Shop Qatar
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </>
  );
}
