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
  Sparkles,
  Truck,
} from 'lucide-react';
import StorefrontLiveCatalogSection from '@/components/catalog/storefront-live-catalog-section';
import { zeeNigeriaCategories } from '@/data/zee-nigeria-store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ZEE Beauty & Fashion World Nigeria',
  description:
    'Shop skincare, haircare, makeup, fragrances, fashion and personal-care essentials from ZEE Beauty & Fashion World in Osogbo.',
};

const storeNavigation = [
  { label: 'New in', href: '#zee-new' },
  { label: 'Skincare', href: '#zee-categories' },
  { label: 'Haircare', href: '#zee-categories' },
  { label: 'Makeup', href: '#zee-categories' },
  { label: 'Fashion', href: '#zee-fashion' },
  { label: 'Visit store', href: '#visit-zee' },
];

export default function ZeeBeautyFashionPage() {
  return (
    <>
      <section className="border-b border-[#f0b7cd]/15 bg-[#3a0d27] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <Link
            href="/ng/zee-beauty-fashion"
            className="flex items-center gap-4"
          >
            <div className="grid h-16 w-16 place-items-center border border-[#f0b7cd]/30 bg-[#59173a] font-display text-3xl font-semibold">
              Z
            </div>

            <div>
              <p className="text-xl font-extrabold tracking-[0.08em]">
                ZEE
              </p>
              <p className="mt-1 text-[7px] font-extrabold uppercase tracking-[0.3em] text-[#f0b7cd]">
                Beauty & Fashion World · Osogbo
              </p>
            </div>
          </Link>

          <nav
            className="hide-scrollbar flex gap-7 overflow-x-auto"
            aria-label="ZEE Beauty and Fashion departments"
          >
            {storeNavigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="shrink-0 text-[8px] font-extrabold uppercase tracking-[0.17em] text-white/58 transition hover:text-[#f0b7cd]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <a
            href="https://wa.me/2349159894953"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-[#f0b7cd]/35 px-5 text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#f4c8d9] transition hover:bg-[#f0b7cd] hover:text-[#49102f]"
          >
            <MessageCircle size={15} />
            WhatsApp store
          </a>
        </div>
      </section>

      <section className="zee-nigeria-commerce-hero bg-[#4a102f] px-5 py-6 text-white md:py-10">
        <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[0.94fr_1.06fr]">
          <div className="grid min-h-[610px] grid-cols-2 grid-rows-2 gap-4">
            <div className="group relative row-span-2 overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1100&auto=format&fit=crop&q=90"
                alt="ZEE beauty collection"
                fill
                priority
                sizes="(max-width: 1024px) 50vw, 27vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#4a102f]/90 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#f4bdd2]">
                  Beauty routine
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold">
                  Care made beautifully simple.
                </h2>
              </div>
            </div>

            <div className="group relative overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&auto=format&fit=crop&q=90"
                alt="ZEE makeup collection"
                fill
                sizes="(max-width: 1024px) 50vw, 27vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#4a102f]/92 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#f4bdd2]">
                  Makeup
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold">
                  Everyday colour.
                </h2>
              </div>
            </div>

            <div className="group relative overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&auto=format&fit=crop&q=90"
                alt="ZEE fashion collection"
                fill
                sizes="(max-width: 1024px) 50vw, 27vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#f2c4d5]">
                  Fashion
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold">
                  Dress the way you feel.
                </h2>
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[610px] flex-col justify-center overflow-hidden border border-white/10 bg-[#5a173a] p-8 sm:p-12 lg:p-16">
            <div className="absolute right-[-100px] top-[-90px] h-80 w-80 rounded-full bg-[#f3b5ce]/15 blur-3xl" />
            <div className="absolute bottom-[-110px] left-[-90px] h-72 w-72 rounded-full bg-[#f4e0d9]/8 blur-3xl" />

            <div className="relative">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.28em] text-[#f3bfd3]">
                Beauty, fashion and care in one world
              </p>

              <h1 className="mt-7 max-w-3xl font-display text-6xl font-semibold leading-[0.88] tracking-[-0.04em] sm:text-7xl">
                Your routine.
                <br />
                Your style.
              </h1>

              <p className="mt-8 max-w-xl text-base leading-8 text-white/66">
                Discover skincare, haircare, makeup, fragrances, fashion and
                personal-care essentials selected for real everyday routines.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="#zee-new"
                  className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#f0b7cd] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#4a102f] transition hover:bg-[#f6ccdc]"
                >
                  Shop new arrivals
                  <ArrowRight size={16} />
                </Link>

                <Link
                  href="#zee-categories"
                  className="inline-flex min-h-14 items-center justify-center border border-white/25 px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] transition hover:bg-white hover:text-[#4a102f]"
                >
                  Explore departments
                </Link>
              </div>

              <div className="mt-12 grid gap-5 border-t border-white/10 pt-7 sm:grid-cols-3">
                <span className="flex items-center gap-3 text-[10px] text-white/60">
                  <Truck size={16} className="text-[#f0b7cd]" />
                  Nationwide delivery
                </span>
                <span className="flex items-center gap-3 text-[10px] text-white/60">
                  <Sparkles size={16} className="text-[#f5d4df]" />
                  Same-day Osogbo delivery where available
                </span>
                <span className="flex items-center gap-3 text-[10px] text-white/60">
                  <MapPin size={16} className="text-[#f0b7cd]" />
                  Pickup in Osogbo
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="zee-categories"
        className="bg-[#f2e4e7] px-5 py-20 md:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#99506f]">
                Shop your routine
              </p>
              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] text-[#3b1024] sm:text-6xl">
                Beauty and fashion, your way.
              </h2>
            </div>

            <Link
              href="/ng/zee-beauty-fashion/shop"
              className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#3b1024]"
            >
              Shop everything
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {zeeNigeriaCategories.map((category, index) => (
              <Link
                key={category.name}
                href={category.href}
                className={`group relative overflow-hidden ${
                  index === 0 ? 'min-h-[500px] lg:row-span-2' : 'min-h-[360px]'
                }`}
              >
                <Image
                  src={category.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#3d1028]/95 via-black/10 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                  <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#f2bed2]">
                    Department {String(index + 1).padStart(2, '0')}
                  </p>

                  <h3 className="mt-3 font-display text-3xl font-semibold">
                    {category.name}
                  </h3>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/65">
                    {category.description}
                  </p>

                  <span className="mt-5 inline-flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#f2bed2]">
                    Explore
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div id="zee-new">
        <StorefrontLiveCatalogSection storefrontCode="ZBF" />
      </div>

      <section
        id="zee-fashion"
        className="bg-[#3d1028] px-5 py-20 text-white md:py-28"
      >
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex min-h-[570px] flex-col justify-center border border-white/10 bg-[#541735] p-8 sm:p-12">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.25em] text-[#f0b7cd]">
              Style, care and confidence
            </p>

            <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.95]">
              Build a routine that feels like yours.
            </h2>

            <p className="mt-7 text-sm leading-8 text-white/62">
              ZEE combines practical beauty and personal-care essentials with
              fashion pieces and accessories for everyday expression.
            </p>

            <div className="mt-9 grid gap-5 sm:grid-cols-2">
              <div className="border border-white/10 bg-black/10 p-5">
                <BadgeCheck size={22} className="text-[#f0b7cd]" />
                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Carefully selected
                </p>
                <p className="mt-2 text-xs leading-6 text-white/48">
                  Useful products chosen for daily routines and personal style.
                </p>
              </div>

              <div className="border border-white/10 bg-black/10 p-5">
                <Heart size={22} className="text-[#f4cddd]" />
                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Personal experience
                </p>
                <p className="mt-2 text-xs leading-6 text-white/48">
                  Direct store support through WhatsApp when you need help.
                </p>
              </div>

              <div className="border border-white/10 bg-black/10 p-5">
                <PackageCheck size={22} className="text-[#f0b7cd]" />
                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Pickup available
                </p>
                <p className="mt-2 text-xs leading-6 text-white/48">
                  Reserve online and collect directly from the Osogbo store.
                </p>
              </div>

              <div className="border border-white/10 bg-black/10 p-5">
                <Truck size={22} className="text-[#f4cddd]" />
                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                  Delivery options
                </p>
                <p className="mt-2 text-xs leading-6 text-white/48">
                  Osogbo and nationwide fulfilment where practical.
                </p>
              </div>
            </div>
          </div>

          <div className="relative min-h-[570px] overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1400&auto=format&fit=crop&q=90"
              alt="ZEE fashion collection"
              fill
              sizes="(max-width: 1024px) 100vw, 57vw"
              className="object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#3d1028]/80 via-transparent to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-8">
              <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#f0b7cd]">
                The ZEE fashion edit
              </p>

              <h3 className="mt-3 max-w-xl font-display text-4xl font-semibold">
                Everyday pieces. Personal expression.
              </h3>
            </div>
          </div>
        </div>
      </section>

      <section id="visit-zee" className="bg-[#efbfd1] px-5 py-16 text-[#46102e]">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#8a4965]">
              Visit or contact ZEE
            </p>

            <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-none sm:text-5xl">
              Shop online, collect in Osogbo or request delivery.
            </h2>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-[#713a52]">
              Okinni, Olaoluwa Estate, Osogbo, Osun State.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-[#46102e]/18 bg-white/25 p-5">
              <Clock3 size={22} />

              <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                Opening hours
              </p>

              <p className="mt-2 text-sm">Every day, 10:00 AM–6:00 PM</p>
            </div>

            <div className="border border-[#46102e]/18 bg-white/25 p-5">
              <MessageCircle size={22} />

              <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[0.17em]">
                WhatsApp
              </p>

              <p className="mt-2 text-sm">09159894953</p>
            </div>
          </div>

          <a
            href="https://wa.me/2349159894953"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#46102e] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white lg:col-start-2"
          >
            Message ZEE
            <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </>
  );
}
