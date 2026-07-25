import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Headphones,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import DiscoveryProductCard from '@/components/sorvyra/discovery-product-card';
import { discoveryProducts } from '@/data/sorvyra-discovery';

const stores = [
  {
    name: 'ATILOSZY',
    eyebrow: 'Varieties Store · Nigeria',
    description:
      'Shoes, home essentials, useful gadgets, gifts and products for everyday living.',
    href: '/ng/atiloszy',
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1400&auto=format&fit=crop&q=90',
    accent: '#d3ae55',
  },
  {
    name: 'ZEE Beauty & Fashion',
    eyebrow: 'Beauty, Fashion & Care · Nigeria',
    description:
      'Skincare, haircare, makeup, clothing, accessories and personal-care essentials.',
    href: '/ng/zee-beauty-fashion',
    image:
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1400&auto=format&fit=crop&q=90',
    accent: '#efa9c8',
  },
  {
    name: 'DENALD',
    eyebrow: 'Solar, CCTV & Computer · Nigeria',
    description:
      'Power solutions, security systems, computers and professional installation services.',
    href: '/ng/denald',
    image:
      'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=1400&auto=format&fit=crop&q=90',
    accent: '#f4c642',
  },
  {
    name: 'Zee COMFORT HUB',
    eyebrow: 'Comfort Essentials · Qatar',
    description:
      'Underwear, sleepwear, leggings, loungewear and everyday essentials for women and men.',
    href: '/qa/zee-comfort-hub',
    image:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1400&auto=format&fit=crop&q=90',
    accent: '#eeb5c5',
  },
];

const departments = [
  {
    name: 'Shoes & Accessories',
    href: '/ng/atiloszy',
    image:
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=1000&auto=format&fit=crop&q=88',
  },
  {
    name: 'Beauty & Personal Care',
    href: '/ng/zee-beauty-fashion',
    image:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1000&auto=format&fit=crop&q=88',
  },
  {
    name: 'Home & Everyday Living',
    href: '/ng/atiloszy',
    image:
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1000&auto=format&fit=crop&q=88',
  },
  {
    name: 'Solar & Backup Power',
    href: '/ng/denald',
    image:
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1000&auto=format&fit=crop&q=88',
  },
  {
    name: 'Technology & Security',
    href: '/ng/denald',
    image:
      'https://images.unsplash.com/photo-1558002038-1055907df827?w=1000&auto=format&fit=crop&q=88',
  },
  {
    name: 'Comfort & Loungewear',
    href: '/qa/zee-comfort-hub',
    image:
      'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1000&auto=format&fit=crop&q=88',
  },
];

export default function Home() {
  return (
    <>
      <section className="sorvyra-commerce-hero px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[1.55fr_0.8fr]">
          <article className="relative min-h-[560px] overflow-hidden lg:min-h-[610px]">
            <Image
              src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1800&auto=format&fit=crop&q=92"
              alt="Premium retail display"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-r from-[#071019]/95 via-[#071019]/65 to-[#071019]/15" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-transparent to-transparent" />

            <div className="relative flex min-h-[560px] max-w-3xl flex-col justify-center p-7 sm:p-12 lg:min-h-[610px] lg:p-16">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.28em] text-[#e1bd69]">
                The SORVYRA edit
              </p>

              <h1 className="mt-6 font-display text-5xl font-semibold leading-[0.92] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
                Everything you need,
                <br />
                across stores you trust.
              </h1>

              <p className="mt-7 max-w-xl text-sm leading-7 text-white/72 sm:text-base">
                Discover fashion, beauty, daily essentials, technology,
                comfort products and professional services across Nigeria and Qatar.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="#shop-stores"
                  className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#d4ad55] px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#0a1119] transition hover:bg-[#e4c36e]"
                >
                  Start shopping
                  <ArrowRight size={16} />
                </Link>

                <Link
                  href="/ng"
                  className="inline-flex min-h-14 items-center justify-center border border-white/30 bg-black/15 px-8 text-[9px] font-extrabold uppercase tracking-[0.18em] backdrop-blur transition hover:bg-white hover:text-[#0a1119]"
                >
                  Explore Nigeria
                </Link>
              </div>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Link
              href="/ng/zee-beauty-fashion"
              className="group relative min-h-[272px] overflow-hidden lg:min-h-0"
            >
              <Image
                src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1100&auto=format&fit=crop&q=90"
                alt="Beauty products"
                fill
                sizes="(max-width: 1024px) 50vw, 34vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#321021]/90 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.22em] text-[#f3b9d1]">
                  Beauty and fashion
                </p>
                <h2 className="mt-2 font-display text-4xl font-semibold">
                  Your new routine.
                </h2>
                <p className="mt-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em]">
                  Shop ZEE <ArrowRight size={14} />
                </p>
              </div>
            </Link>

            <Link
              href="/ng/denald"
              className="group relative min-h-[272px] overflow-hidden lg:min-h-0"
            >
              <Image
                src="https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=1100&auto=format&fit=crop&q=90"
                alt="Solar power installation"
                fill
                sizes="(max-width: 1024px) 50vw, 34vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06172d]/95 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.22em] text-[#f3c94d]">
                  Solar and technology
                </p>
                <h2 className="mt-2 font-display text-4xl font-semibold">
                  Power your world.
                </h2>
                <p className="mt-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em]">
                  Explore DENALD <ArrowRight size={14} />
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#0c151e] px-5 py-6 text-white">
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-4">
            <Truck className="text-[#5ed0ca]" size={23} strokeWidth={1.5} />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em]">
                Flexible delivery
              </p>
              <p className="mt-1 text-xs text-white/48">Nigeria and Qatar coverage</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <BadgeCheck className="text-[#d4ad55]" size={23} strokeWidth={1.5} />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em]">
                Owned storefronts
              </p>
              <p className="mt-1 text-xs text-white/48">Not a third-party marketplace</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Headphones className="text-[#5ed0ca]" size={23} strokeWidth={1.5} />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em]">
                Direct support
              </p>
              <p className="mt-1 text-xs text-white/48">WhatsApp support per store</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ShieldCheck className="text-[#d4ad55]" size={23} strokeWidth={1.5} />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em]">
                Secure shopping
              </p>
              <p className="mt-1 text-xs text-white/48">Protected accounts and checkout</p>
            </div>
          </div>
        </div>
      </section>

      <section id="shop-stores" className="bg-[#111b25] px-5 py-20 text-white md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.26em] text-[#d4ad55]">
                Shop by store
              </p>
              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">
                Four stores. Four experiences.
              </h2>
            </div>

            <Link
              href="/ng"
              className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/62 hover:text-[#5ed0ca]"
            >
              View regional stores <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {stores.map((store) => (
              <Link
                key={store.name}
                href={store.href}
                className="group relative min-h-[440px] overflow-hidden"
              >
                <Image
                  src={store.image}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.045]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/28 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-7 sm:p-9">
                  <p
                    className="text-[8px] font-extrabold uppercase tracking-[0.22em]"
                    style={{ color: store.accent }}
                  >
                    {store.eyebrow}
                  </p>

                  <h3 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
                    {store.name}
                  </h3>

                  <p className="mt-4 max-w-lg text-sm leading-7 text-white/65">
                    {store.description}
                  </p>

                  <span className="mt-7 inline-flex items-center gap-3 text-[9px] font-extrabold uppercase tracking-[0.18em]">
                    Enter store <ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#e7e1d6] px-5 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-[#79602e]">
                Trending across SORVYRA
              </p>
              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.03em] text-[#111820] sm:text-6xl">
                Products worth discovering.
              </h2>
            </div>

            <Link
              href="/shop"
              className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#111820]"
            >
              Shop all products <ArrowRight size={15} />
            </Link>
          </div>

          <div className="hide-scrollbar mt-12 flex gap-5 overflow-x-auto pb-5">
            {discoveryProducts.map((product) => (
              <DiscoveryProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0a1119] px-5 py-20 text-white md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.26em] text-[#5ed0ca]">
            Shop by department
          </p>

          <h2 className="mt-4 max-w-3xl font-display text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">
            Find your next essential.
          </h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((department) => (
              <Link
                key={department.name}
                href={department.href}
                className="group relative min-h-[330px] overflow-hidden"
              >
                <Image
                  src={department.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                  <h3 className="max-w-[75%] font-display text-3xl font-semibold leading-none">
                    {department.name}
                  </h3>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/30 bg-black/20 backdrop-blur transition group-hover:bg-white group-hover:text-black">
                    <ArrowRight size={17} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0c888c] px-5 py-16 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-white/68">
              Shopping in Nigeria or Qatar?
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
              Choose your region and see the right stores and currency.
            </h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/ng"
              className="inline-flex min-h-13 items-center justify-center bg-[#0a1119] px-7 py-4 text-[9px] font-extrabold uppercase tracking-[0.18em]"
            >
              Shop Nigeria
            </Link>
            <Link
              href="/qa"
              className="inline-flex min-h-13 items-center justify-center border border-white/35 px-7 py-4 text-[9px] font-extrabold uppercase tracking-[0.18em]"
            >
              Shop Qatar
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
