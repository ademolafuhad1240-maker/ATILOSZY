import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Clock3,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import ComfortProductCard from '@/components/zee-comfort/comfort-product-card';
import {
  comfortCategories,
  comfortProducts,
} from '@/data/zee-comfort-store';

export const metadata: Metadata = {
  title: 'Shop Qatar',
  description:
    'Shop Zee COMFORT HUB for women’s and men’s comfort essentials with pickup in Doha and delivery throughout Qatar.',
};

export default function QatarPage() {
  return (
    <>
      <section className="sorvyra-qatar-hero bg-[#401326] px-5 py-8 text-white md:py-12">
        <div className="mx-auto grid max-w-[1440px] gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative min-h-[590px] overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1500&auto=format&fit=crop&q=92"
              alt="Women’s comfort and fashion collection"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#401326]/95 via-[#401326]/20 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.25em] text-[#f2c9d2]">
                Zee COMFORT HUB · Doha
              </p>

              <h2 className="mt-4 max-w-xl font-display text-5xl font-semibold leading-[0.92] sm:text-6xl">
                Comfort for every you.
              </h2>

              <p className="mt-5 max-w-lg text-sm leading-7 text-white/68">
                Women’s essentials, loungewear, sleepwear, leggings and
                carefully selected everyday pieces.
              </p>
            </div>
          </div>

          <div className="relative flex min-h-[590px] flex-col justify-center overflow-hidden border border-white/10 bg-[#5a1d35] p-8 sm:p-12 lg:p-16">
            <div className="absolute right-[-100px] top-[-100px] h-80 w-80 rounded-full bg-[#f1c5cf]/16 blur-3xl" />
            <div className="absolute bottom-[-120px] left-[-90px] h-72 w-72 rounded-full bg-[#e5b8c2]/8 blur-3xl" />

            <div className="relative">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.28em] text-[#f2c9d2]">
                SORVYRA STORE Qatar
              </p>

              <h1 className="mt-7 max-w-3xl font-display text-6xl font-semibold leading-[0.88] tracking-[-0.04em] sm:text-7xl">
                Shop comfort,
                <br />
                across Qatar.
              </h1>

              <p className="mt-8 max-w-xl text-base leading-8 text-white/64">
                Discover underwear, bras, leggings, sleepwear, loungewear,
                vintage clothing, shirts and everyday essentials from Zee
                COMFORT HUB.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/qa/zee-comfort-hub"
                  className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#efc4ce] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#481428] transition hover:bg-[#f6d6dd]"
                >
                  Enter Zee COMFORT HUB
                  <ArrowRight size={16} />
                </Link>

                <a
                  href="https://wa.me/97430975465"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-14 items-center justify-center gap-3 border border-white/25 px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] transition hover:bg-white hover:text-[#481428]"
                >
                  WhatsApp store
                  <MessageCircle size={16} />
                </a>
              </div>

              <div className="mt-12 grid gap-5 border-t border-white/10 pt-7 sm:grid-cols-3">
                <span className="flex items-center gap-3 text-[10px] text-white/60">
                  <Truck size={16} className="text-[#efc4ce]" />
                  Delivery across Qatar
                </span>

                <span className="flex items-center gap-3 text-[10px] text-white/60">
                  <MapPin size={16} className="text-[#efc4ce]" />
                  Pickup in Doha
                </span>

                <span className="flex items-center gap-3 text-[10px] text-white/60">
                  <ShieldCheck size={16} className="text-[#efc4ce]" />
                  Prices shown in QAR
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f3e8e8] px-5 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#9b5a6d]">
                Shop by comfort
              </p>

              <h2 className="mt-4 max-w-3xl font-display text-5xl font-semibold tracking-[-0.03em] text-[#481428] sm:text-6xl">
                Find what feels right.
              </h2>
            </div>

            <Link
              href="/qa/zee-comfort-hub"
              className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#481428]"
            >
              Explore the store
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {comfortCategories.map((category) => (
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

                <div className="absolute inset-0 bg-gradient-to-t from-[#481428]/94 via-black/10 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                  <h3 className="font-display text-3xl font-semibold">
                    {category.name}
                  </h3>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/64">
                    {category.description}
                  </p>

                  <span className="mt-5 inline-flex items-center gap-2 text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#f2c9d2]">
                    Explore
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
                Featured in Qatar
              </p>

              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] text-[#481428] sm:text-6xl">
                Comfort picks in QAR.
              </h2>
            </div>

            <Link
              href="/qa/zee-comfort-hub/shop"
              className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#481428]"
            >
              View complete collection
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

      <section className="bg-[#481428] px-5 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
          <article className="border border-white/10 bg-white/[0.035] p-8">
            <PackageCheck size={26} className="text-[#efc4ce]" />

            <h3 className="mt-7 font-display text-3xl font-semibold">
              Doha pickup
            </h3>

            <p className="mt-4 text-sm leading-7 text-white/55">
              Reserve eligible products and arrange collection from Fareej
              Abdul Aziz, Doha.
            </p>
          </article>

          <article className="border border-white/10 bg-white/[0.035] p-8">
            <Truck size={26} className="text-[#efc4ce]" />

            <h3 className="mt-7 font-display text-3xl font-semibold">
              Qatar-wide delivery
            </h3>

            <p className="mt-4 text-sm leading-7 text-white/55">
              Delivery is available across Qatar after product payment and
              delivery arrangements are confirmed.
            </p>
          </article>

          <article className="border border-white/10 bg-white/[0.035] p-8">
            <Clock3 size={26} className="text-[#efc4ce]" />

            <h3 className="mt-7 font-display text-3xl font-semibold">
              Daily support
            </h3>

            <p className="mt-4 text-sm leading-7 text-white/55">
              Store hours are 10:00 AM–6:00 PM daily, while WhatsApp messages
              are accepted at any time.
            </p>
          </article>
        </div>
      </section>

      <section className="bg-[#efc4ce] px-5 py-16 text-[#481428]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.23em] text-[#905366]">
              Visit Zee COMFORT HUB
            </p>

            <h2 className="mt-3 max-w-4xl font-display text-4xl font-semibold leading-none sm:text-5xl">
              Shop online, collect in Doha or request delivery across Qatar.
            </h2>

            <p className="mt-5 text-sm text-[#754355]">
              Fareej Abdul Aziz, Doha · +974 3097 5465
            </p>
          </div>

          <a
            href="https://wa.me/97430975465"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-14 shrink-0 items-center justify-center gap-3 bg-[#481428] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white"
          >
            Message Zee COMFORT HUB
            <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </>
  );
}
