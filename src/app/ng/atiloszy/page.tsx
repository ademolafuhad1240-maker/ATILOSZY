import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Truck,
  Zap,
} from 'lucide-react';
import StorefrontLiveCatalogSection from '@/components/catalog/storefront-live-catalog-section';
import { atiloszyCategories } from '@/data/atiloszy-store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ATILOSZY Varieties Store',
  description:
    'Shop footwear, home products, kitchen essentials, gadgets, gifts and everyday essentials from ATILOSZY in Osogbo.',
};

const storeNavigation = [
  { label: 'Shop all', href: '/ng/atiloszy/shop' },
  { label: 'New arrivals', href: '#new-arrivals' },
  { label: 'Footwear', href: '#categories' },
  { label: 'Home', href: '#categories' },
  { label: 'Gadgets', href: '#categories' },
  { label: 'Gifts', href: '#categories' },
  { label: 'Visit store', href: '#visit-atiloszy' },
];

export default function AtiloszyPage() {
  return (
    <>
      <section className="border-b border-[#d8bd69]/15 bg-[#03130c] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/ng/atiloszy" className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden border border-[#d8bd69]/25 bg-black">
              <Image
                src="/brand/atiloszy-logo-original.png"
                alt="ATILOSZY logo"
                fill
                sizes="64px"
                className="object-contain"
              />
            </div>

            <div>
              <p className="text-xl font-extrabold tracking-[0.12em]">
                ATILOSZY
              </p>
              <p className="mt-1 text-[7px] font-extrabold uppercase tracking-[0.32em] text-[#d8bd69]">
                Varieties Store · Osogbo
              </p>
            </div>
          </Link>

          <nav
            className="hide-scrollbar flex gap-7 overflow-x-auto"
            aria-label="ATILOSZY departments"
          >
            {storeNavigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="shrink-0 text-[8px] font-extrabold uppercase tracking-[0.17em] text-white/58 transition hover:text-[#d8bd69]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <a
            href="https://wa.me/2347074417879"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-[#d8bd69]/35 px-5 text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#e2c872] transition hover:bg-[#d8bd69] hover:text-[#082317]"
          >
            <MessageCircle size={15} />
            WhatsApp store
          </a>
        </div>
      </section>

      <section className="atiloszy-commerce-hero bg-[#03130c] px-5 py-6 text-white md:py-10">
        <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[0.94fr_1.06fr]">
          <div className="order-2 relative flex min-h-[600px] flex-col justify-center overflow-hidden border border-white/10 bg-[#082317] p-8 sm:p-12 lg:p-16">
            <div className="absolute right-[-120px] top-[-100px] h-80 w-80 rounded-full bg-[#16a664]/18 blur-3xl" />
            <div className="absolute bottom-[-120px] left-[-100px] h-72 w-72 rounded-full bg-[#d8bd69]/10 blur-3xl" />

            <div className="relative">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.28em] text-[#d8bd69]">
                Useful products. Thoughtfully selected.
              </p>

              <h1 className="mt-7 max-w-3xl font-display text-6xl font-semibold leading-[0.88] tracking-[-0.04em] sm:text-7xl">
                Everyday variety,
                <br />
                made better.
              </h1>

              <p className="mt-8 max-w-xl text-base leading-8 text-white/62">
                Shop footwear, home essentials, useful gadgets, fashion
                accessories, gifts and practical products for everyday life.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="#new-arrivals"
                  className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#d8bd69] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#082317] transition hover:bg-[#ead582]"
                >
                  Shop new arrivals
                  <ArrowRight size={16} />
                </Link>

                <Link
                  href="#categories"
                  className="inline-flex min-h-14 items-center justify-center border border-white/20 px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] transition hover:bg-white hover:text-[#082317]"
                >
                  Browse categories
                </Link>
              </div>

              <div className="mt-12 grid gap-5 border-t border-white/10 pt-7 sm:grid-cols-3">
                <span className="flex items-center gap-3 text-[10px] text-white/58">
                  <Zap size={16} className="text-[#d8bd69]" />
                  Same-day Osogbo delivery where available
                </span>
                <span className="flex items-center gap-3 text-[10px] text-white/58">
                  <Truck size={16} className="text-[#55c989]" />
                  Nationwide delivery
                </span>
                <span className="flex items-center gap-3 text-[10px] text-white/58">
                  <MapPin size={16} className="text-[#d8bd69]" />
                  Pickup in Osogbo
                </span>
              </div>
            </div>
          </div>

          <div className="order-1 grid min-h-[600px] grid-cols-2 grid-rows-2 gap-4">
            <div className="group relative col-span-2 overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=1400&auto=format&fit=crop&q=90"
                alt="ATILOSZY footwear collection"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 49vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#e4c96f]">
                  The footwear edit
                </p>
                <h2 className="mt-2 font-display text-4xl font-semibold">
                  Step into something new.
                </h2>
              </div>
            </div>

            <div className="group relative overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&auto=format&fit=crop&q=90"
                alt="ATILOSZY home products"
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#082317]/95 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#d8bd69]">
                  Home & living
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold">
                  Make daily life easier.
                </h2>
              </div>
            </div>

            <div className="group relative overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=900&auto=format&fit=crop&q=90"
                alt="ATILOSZY gadgets"
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#55c989]">
                  Useful gadgets
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold">
                  Smart additions for every day.
                </h2>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="categories"
        className="bg-[#e9e3d8] px-5 py-20 md:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#80662f]">
                Shop by category
              </p>
              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] text-[#102219] sm:text-6xl">
                Find what fits your day.
              </h2>
            </div>

            <Link
              href="/ng/atiloszy/shop"
              className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#102219]"
            >
              Shop everything
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {atiloszyCategories.map((category) => (
              <Link
                key={category.name}
                href={category.href}
                className="group relative min-h-[390px] overflow-hidden"
              >
                <Image
                  src={category.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#04130c]/94 via-black/15 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                  <h3 className="font-display text-3xl font-semibold">
                    {category.name}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/62">
                    {category.description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#e1c66e]">
                    Explore category
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div id="new-arrivals">
        <StorefrontLiveCatalogSection storefrontCode="ATI" />
      </div>

      <section className="bg-[#062317] px-5 py-20 text-white md:py-28">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-[560px] overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1400&auto=format&fit=crop&q=90"
              alt="Everyday shopping products"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/62 to-transparent" />
            <p className="absolute bottom-7 left-7 text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#e2c872]">
              The ATILOSZY everyday edit
            </p>
          </div>

          <div className="flex min-h-[560px] flex-col justify-center border border-white/10 bg-[#0a301f] p-8 sm:p-12">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.25em] text-[#d8bd69]">
              More than a varieties store
            </p>

            <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.95]">
              Useful things should still feel special.
            </h2>

            <p className="mt-7 text-sm leading-8 text-white/60">
              ATILOSZY brings practical everyday products together with
              thoughtful presentation, direct customer support and flexible
              fulfilment from Osogbo.
            </p>

            <div className="mt-9 grid gap-5 sm:grid-cols-2">
              <div className="border border-white/10 bg-black/10 p-5">
                <BadgeCheck size={22} className="text-[#d8bd69]" />
                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Carefully selected
                </p>
                <p className="mt-2 text-xs leading-6 text-white/48">
                  Products chosen for usefulness, value and daily relevance.
                </p>
              </div>

              <div className="border border-white/10 bg-black/10 p-5">
                <ShieldCheck size={22} className="text-[#55c989]" />
                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Direct store support
                </p>
                <p className="mt-2 text-xs leading-6 text-white/48">
                  Speak directly with the ATILOSZY team through WhatsApp.
                </p>
              </div>

              <div className="border border-white/10 bg-black/10 p-5">
                <PackageCheck size={22} className="text-[#55c989]" />
                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Pickup available
                </p>
                <p className="mt-2 text-xs leading-6 text-white/48">
                  Reserve online and collect from the physical store.
                </p>
              </div>

              <div className="border border-white/10 bg-black/10 p-5">
                <Truck size={22} className="text-[#d8bd69]" />
                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Delivery options
                </p>
                <p className="mt-2 text-xs leading-6 text-white/48">
                  Osogbo delivery and nationwide fulfilment where practical.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="visit-atiloszy"
        className="bg-[#d8bd69] px-5 py-16 text-[#082317]"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#42634e]">
              Visit or contact ATILOSZY
            </p>

            <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-none sm:text-5xl">
              Shop online, collect in Osogbo or request delivery.
            </h2>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-[#294637]">
              Shop 1, Akilog Complex, opposite Al-Mitiqeey Mosque, Ire Akari,
              Oke Ijetu, Ilesa Garage, Osogbo, Osun State.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-[#082317]/18 bg-white/25 p-5">
              <Clock3 size={22} />
              <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                Opening hours
              </p>
              <p className="mt-2 text-sm">Every day, 10:00 AM–6:00 PM</p>
            </div>

            <div className="border border-[#082317]/18 bg-white/25 p-5">
              <MessageCircle size={22} />
              <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                WhatsApp
              </p>
              <p className="mt-2 text-sm">07074417879</p>
            </div>
          </div>

          <a
            href="https://wa.me/2347074417879"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#082317] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white lg:col-start-2"
          >
            Message ATILOSZY
            <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </>
  );
}
