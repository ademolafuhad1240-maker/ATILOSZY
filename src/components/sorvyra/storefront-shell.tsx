import Image from 'next/image';
import Link from 'next/link';
import type { Storefront, StorefrontTheme } from '@/data/storefronts';

interface StorefrontShellProps {
  storefront: Storefront;
  serviceStore?: boolean;
}

const themeClasses: Record<
  StorefrontTheme,
  {
    hero: string;
    accent: string;
    button: string;
    soft: string;
  }
> = {
  atiloszy: {
    hero: 'bg-[#020604]',
    accent: 'text-[#d4af5f]',
    button: 'bg-[#d4af5f] text-[#10231b]',
    soft: 'bg-[#ede3cb]',
  },
  'zee-nigeria': {
    hero: 'bg-[#3e1029]',
    accent: 'text-[#f1b9d3]',
    button: 'bg-[#f1b9d3] text-[#3e1029]',
    soft: 'bg-[#f8e8ef]',
  },
  denald: {
    hero: 'bg-[#07172b]',
    accent: 'text-[#ffc52c]',
    button: 'bg-[#ffc52c] text-[#07172b]',
    soft: 'bg-[#e9f0f7]',
  },
  'zee-qatar': {
    hero: 'bg-[#55112d]',
    accent: 'text-[#efb6c4]',
    button: 'bg-[#efb6c4] text-[#55112d]',
    soft: 'bg-[#f6e8ec]',
  },
};

export default function StorefrontShell({
  storefront,
  serviceStore = false,
}: StorefrontShellProps) {
  const theme = themeClasses[storefront.theme];

  return (
    <>
      <section
        className={`relative min-h-[720px] overflow-hidden px-5 py-16 text-white md:py-24 ${theme.hero}`}
      >
        <Image
          src={storefront.coverImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-28"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/58 to-black/12" />

        <div className="relative mx-auto flex min-h-[590px] max-w-7xl items-center">
          <div className="max-w-3xl">
            <Link
              href={`/${storefront.regionCode}`}
              className={`text-[9px] font-bold uppercase tracking-[0.24em] ${theme.accent}`}
            >
              ← Back to {storefront.country}
            </Link>

            <div className="mt-12">
              {storefront.logo ? (
                <div className="relative h-36 w-36 overflow-hidden bg-black/35 shadow-2xl backdrop-blur">
                  <Image
                    src={storefront.logo}
                    alt={`${storefront.shortName} logo`}
                    fill
                    sizes="144px"
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="inline-flex border border-white/28 bg-white/8 px-6 py-5 backdrop-blur">
                  <div>
                    <p className="font-display text-5xl font-semibold leading-none">ZEE</p>
                    <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.3em] text-[#f1b9d3]">
                      Beauty & Fashion World
                    </p>
                  </div>
                </div>
              )}
            </div>

            <p
              className={`mt-9 text-[10px] font-extrabold uppercase tracking-[0.3em] ${theme.accent}`}
            >
              {storefront.locationLabel} · {storefront.currency}
            </p>

            <h1 className="mt-5 font-display text-6xl font-semibold leading-[0.9] tracking-[-0.04em] md:text-8xl">
              {storefront.name}
            </h1>

            <p className="mt-8 max-w-2xl text-base leading-8 text-white/68 md:text-lg">
              {storefront.description}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#collections"
                className={`inline-flex min-h-14 items-center justify-center px-8 text-[10px] font-extrabold uppercase tracking-[0.2em] ${theme.button}`}
              >
                {serviceStore ? 'Explore products & services' : 'Explore collections'}
              </Link>

              <a
                href={storefront.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-14 items-center justify-center border border-white/25 px-8 text-[10px] font-extrabold uppercase tracking-[0.2em] transition hover:bg-white hover:text-black"
              >
                WhatsApp store
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="collections" className={`px-5 py-20 md:py-28 ${theme.soft}`}>
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-black/50">
            Initial catalogue
          </p>
          <h2 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-none tracking-[-0.03em] text-[#131713] md:text-6xl">
            Explore what this store offers.
          </h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {storefront.categories.map((category, index) => (
              <div
                key={category}
                className="min-h-44 border border-black/10 bg-white/58 p-7 shadow-[0_16px_45px_rgba(0,0,0,0.05)] backdrop-blur"
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-black/38">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-7 font-display text-3xl font-semibold leading-none">
                  {category}
                </h3>
                <p className="mt-4 text-sm leading-6 text-black/55">
                  Product listings will be added through the store management system.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f8f6f0] px-5 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#8b7138]">
              Visit
            </p>
            <p className="mt-4 text-sm leading-7 text-black/62">{storefront.address}</p>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#8b7138]">
              Opening hours
            </p>
            <p className="mt-4 text-sm leading-7 text-black/62">{storefront.hours}</p>
            <p className="mt-1 text-xs text-black/45">
              WhatsApp messages are accepted 24 hours.
            </p>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#8b7138]">
              Store support
            </p>
            <a
              href={storefront.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm font-bold underline decoration-[#b7964b] underline-offset-8"
            >
              WhatsApp {storefront.whatsappLabel}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
