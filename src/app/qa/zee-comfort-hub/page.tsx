import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  PackageCheck,
  Ruler,
  Truck,
} from 'lucide-react';
import ComfortProductCard from '@/components/zee-comfort/comfort-product-card';
import {
  comfortCategories,
  comfortProducts,
} from '@/data/zee-comfort-store';

export const metadata: Metadata = {
  title: 'Zee COMFORT HUB Qatar',
  description:
    'Shop sleepwear, leggings, bras, loungewear, underwear and everyday comfort essentials from Zee COMFORT HUB in Doha.',
};

const navigation = [
  { label: 'Shop all', href: '/qa/zee-comfort-hub/shop' },
  { label: 'Women', href: '#comfort-categories' },
  { label: 'Sleepwear', href: '#comfort-categories' },
  { label: 'Leggings', href: '#comfort-categories' },
  { label: 'Loungewear', href: '#comfort-categories' },
  { label: 'Visit store', href: '#visit-comfort-hub' },
];

export default function ZeeComfortHubPage() {
  return (
    <>
      <section className="border-b border-[#efc4ce]/20 bg-[#401326] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <Link
            href="/qa/zee-comfort-hub"
            className="flex items-center gap-4"
          >
            <div className="relative h-16 w-20 overflow-hidden border border-[#efc4ce]/25 bg-[#f6e3e6]">
              <Image
                src="/brand/zee-comfort-hub-logo.png"
                alt="Zee COMFORT HUB logo"
                fill
                sizes="80px"
                className="object-contain p-1"
              />
            </div>

            <div>
              <p className="text-xl font-extrabold tracking-[0.06em]">
                Zee COMFORT HUB
              </p>

              <p className="mt-1 text-[7px] font-extrabold uppercase tracking-[0.28em] text-[#efc4ce]">
                Comfort for every you · Doha
              </p>
            </div>
          </Link>

          <nav
            className="hide-scrollbar flex gap-7 overflow-x-auto"
            aria-label="Zee COMFORT HUB departments"
          >
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="shrink-0 text-[8px] font-extrabold uppercase tracking-[0.17em] text-white/58 transition hover:text-[#efc4ce]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <a
            href="https://wa.me/97430975465"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-[#efc4ce]/35 px-5 text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#efc4ce] transition hover:bg-[#efc4ce] hover:text-[#481428]"
          >
            <MessageCircle size={15} />
            WhatsApp store
          </a>
        </div>
      </section>

      <section className="zee-comfort-commerce-hero bg-[#401326] px-5 py-6 text-white md:py-10">
        <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[0.98fr_1.02fr]">
          <div className="relative flex min-h-[620px] flex-col justify-center overflow-hidden border border-white/10 bg-[#5a1d35] p-8 sm:p-12 lg:p-16">
            <div className="absolute right-[-100px] top-[-100px] h-80 w-80 rounded-full bg-[#efc4ce]/16 blur-3xl" />
            <div className="absolute bottom-[-110px] left-[-90px] h-72 w-72 rounded-full bg-[#f8e7e4]/8 blur-3xl" />

            <div className="relative">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.28em] text-[#efc4ce]">
                Comfort-focused essentials in Qatar
              </p>

              <h1 className="mt-7 max-w-3xl font-display text-6xl font-semibold leading-[0.88] tracking-[-0.04em] sm:text-7xl">
                Feel comfortable.
                <br />
                Feel like yourself.
              </h1>

              <p className="mt-8 max-w-xl text-base leading-8 text-white/65">
                Shop sleepwear, leggings, loungewear, bras, underwear, vintage
                clothing and everyday essentials for women and men.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/qa/zee-comfort-hub/shop"
                  className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#efc4ce] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#481428] transition hover:bg-[#f6d6dd]"
                >
                  Shop all collections
                  <ArrowRight size={16} />
                </Link>

                <Link
                  href="#comfort-categories"
                  className="inline-flex min-h-14 items-center justify-center border border-white/25 px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] transition hover:bg-white hover:text-[#481428]"
                >
                  Explore categories
                </Link>
              </div>

              <div className="mt-12 grid gap-5 border-t border-white/10 pt-7 sm:grid-cols-3">
                <span className="flex items-center gap-3 text-[10px] text-white/60">
                  <Truck size={16} className="text-[#efc4ce]" />
                  Delivery throughout Qatar
                </span>

                <span className="flex items-center gap-3 text-[10px] text-white/60">
                  <MapPin size={16} className="text-[#efc4ce]" />
                  Pickup in Doha
                </span>

                <span className="flex items-center gap-3 text-[10px] text-white/60">
                  <Ruler size={16} className="text-[#efc4ce]" />
                  Size and fit options
                </span>
              </div>
            </div>
          </div>

          <div className="grid min-h-[620px] grid-cols-2 grid-rows-2 gap-4">
            <div className="group relative col-span-2 overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1400&auto=format&fit=crop&q=90"
                alt="Women’s loungewear and everyday clothing"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#481428]/90 via-transparent to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-7">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#efc4ce]">
                  Loungewear and everyday comfort
                </p>

                <h2 className="mt-2 font-display text-4xl font-semibold">
                  Soft essentials for real life.
                </h2>
              </div>
            </div>

            <div className="group relative overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900&auto=format&fit=crop&q=90"
                alt="Women’s sleepwear"
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#481428]/94 via-transparent to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#efc4ce]">
                  Sleepwear
                </p>

                <h2 className="mt-2 font-display text-2xl font-semibold">
                  Unwind in comfort.
                </h2>
              </div>
            </div>

            <div className="group relative overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=900&auto=format&fit=crop&q=90"
                alt="Women’s leggings"
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#481428]/94 via-transparent to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#efc4ce]">
                  Leggings
                </p>

                <h2 className="mt-2 font-display text-2xl font-semibold">
                  Move comfortably.
                </h2>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="comfort-categories"
        className="bg-[#f3e8e8] px-5 py-20 md:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#9b5a6d]">
                Explore every collection
              </p>

              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] text-[#481428] sm:text-6xl">
                Comfort for every part of your day.
              </h2>
            </div>

            <Link
              href="/qa/zee-comfort-hub/shop"
              className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#481428]"
            >
              Shop everything
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {comfortCategories.map((category, index) => (
              <Link
                key={category.name}
                href={category.href}
                className={`group relative overflow-hidden ${
                  index === 0 ? 'min-h-[520px] lg:row-span-2' : 'min-h-[370px]'
                }`}
              >
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#481428]/95 via-black/10 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                  <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#efc4ce]">
                    Collection {String(index + 1).padStart(2, '0')}
                  </p>

                  <h3 className="mt-3 font-display text-3xl font-semibold">
                    {category.name}
                  </h3>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/65">
                    {category.description}
                  </p>

                  <span className="mt-5 inline-flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#efc4ce]">
                    Shop collection
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#fff9f7] px-5 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#9b5a6d]">
                New and comfortable
              </p>

              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] text-[#481428] sm:text-6xl">
                Fresh picks in QAR.
              </h2>
            </div>

            <Link
              href="/qa/zee-comfort-hub/shop"
              className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#481428]"
            >
              View all products
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="hide-scrollbar mt-12 flex gap-5 overflow-x-auto pb-5">
            {comfortProducts.map((product) => (
              <ComfortProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#481428] px-5 py-20 text-white md:py-28">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-[570px] overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1400&auto=format&fit=crop&q=90"
              alt="Women’s comfort fashion"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#481428]/80 via-transparent to-transparent" />

            <p className="absolute bottom-7 left-7 text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#efc4ce]">
              The Zee COMFORT HUB edit
            </p>
          </div>

          <div className="flex min-h-[570px] flex-col justify-center border border-white/10 bg-[#5a1d35] p-8 sm:p-12">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.25em] text-[#efc4ce]">
              Comfort with confidence
            </p>

            <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.95]">
              Essentials should fit your life.
            </h2>

            <p className="mt-7 text-sm leading-8 text-white/62">
              Zee COMFORT HUB combines comfortable pieces, practical sizing,
              direct support and flexible fulfilment throughout Qatar.
            </p>

            <div className="mt-9 grid gap-5 sm:grid-cols-2">
              <article className="border border-white/10 bg-black/10 p-5">
                <Heart size={22} className="text-[#efc4ce]" />

                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Comfort focused
                </p>

                <p className="mt-2 text-xs leading-6 text-white/48">
                  Pieces selected for everyday wear, rest and relaxed moments.
                </p>
              </article>

              <article className="border border-white/10 bg-black/10 p-5">
                <BadgeCheck size={22} className="text-[#efc4ce]" />

                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Direct store support
                </p>

                <p className="mt-2 text-xs leading-6 text-white/48">
                  Ask about sizes, availability and delivery through WhatsApp.
                </p>
              </article>

              <article className="border border-white/10 bg-black/10 p-5">
                <PackageCheck size={22} className="text-[#efc4ce]" />

                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Doha pickup
                </p>

                <p className="mt-2 text-xs leading-6 text-white/48">
                  Reserve eligible products and arrange store collection.
                </p>
              </article>

              <article className="border border-white/10 bg-black/10 p-5">
                <Truck size={22} className="text-[#efc4ce]" />

                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Qatar delivery
                </p>

                <p className="mt-2 text-xs leading-6 text-white/48">
                  Delivery is available throughout Qatar after confirmation.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section
        id="visit-comfort-hub"
        className="bg-[#efc4ce] px-5 py-16 text-[#481428]"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#905366]">
              Visit or contact Zee COMFORT HUB
            </p>

            <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-none sm:text-5xl">
              Shop online, collect in Doha or request delivery across Qatar.
            </h2>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-[#754355]">
              Fareej Abdul Aziz, Doha, Qatar.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-[#481428]/18 bg-white/25 p-5">
              <Clock3 size={22} />

              <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                Opening hours
              </p>

              <p className="mt-2 text-sm">Every day, 10:00 AM–6:00 PM</p>
            </div>

            <div className="border border-[#481428]/18 bg-white/25 p-5">
              <MessageCircle size={22} />

              <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                WhatsApp
              </p>

              <p className="mt-2 text-sm">+974 3097 5465</p>
            </div>
          </div>

          <a
            href="https://wa.me/97430975465"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#481428] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white lg:col-start-2"
          >
            Message Zee COMFORT HUB
            <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </>
  );
}
