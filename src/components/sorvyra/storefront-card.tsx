import Image from 'next/image';
import Link from 'next/link';
import type { Storefront, StorefrontTheme } from '@/data/storefronts';

interface StorefrontCardProps {
  storefront: Storefront;
  featured?: boolean;
}

const themeClasses: Record<
  StorefrontTheme,
  {
    surface: string;
    accent: string;
    button: string;
  }
> = {
  atiloszy: {
    surface: 'bg-[#06130d]',
    accent: 'text-[#d4af5f]',
    button: 'bg-[#d4af5f] text-[#10231b]',
  },
  'zee-nigeria': {
    surface: 'bg-[#3e1029]',
    accent: 'text-[#f1b9d3]',
    button: 'bg-[#f1b9d3] text-[#3e1029]',
  },
  denald: {
    surface: 'bg-[#07172b]',
    accent: 'text-[#ffc52c]',
    button: 'bg-[#ffc52c] text-[#07172b]',
  },
  'zee-qatar': {
    surface: 'bg-[#55112d]',
    accent: 'text-[#efb6c4]',
    button: 'bg-[#efb6c4] text-[#55112d]',
  },
};

export default function StorefrontCard({
  storefront,
  featured = false,
}: StorefrontCardProps) {
  const theme = themeClasses[storefront.theme];

  return (
    <article
      className={`group relative min-h-[520px] overflow-hidden ${
        featured ? 'lg:col-span-2' : ''
      } ${theme.surface}`}
    >
      <Image
        src={storefront.coverImage}
        alt=""
        fill
        sizes={featured ? '(max-width: 1024px) 100vw, 66vw' : '(max-width: 1024px) 100vw, 33vw'}
        className="object-cover opacity-52 transition duration-700 group-hover:scale-[1.035] group-hover:opacity-62"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />

      <div className="absolute inset-x-0 bottom-0 z-10 p-7 text-white sm:p-9">
        <div className="mb-6 flex items-center gap-4">
          {storefront.logo ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-black/55 shadow-2xl">
              <Image
                src={storefront.logo}
                alt={`${storefront.shortName} logo`}
                fill
                sizes="64px"
                className="object-contain"
              />
            </div>
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center border border-white/30 bg-white/10 font-display text-3xl font-semibold">
              Z
            </div>
          )}

          <div>
            <p
              className={`text-[9px] font-extrabold uppercase tracking-[0.25em] ${theme.accent}`}
            >
              {storefront.country} · {storefront.currency}
            </p>
            <p className="mt-1 text-xs text-white/65">{storefront.locationLabel}</p>
          </div>
        </div>

        <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[0.95] sm:text-5xl">
          {storefront.name}
        </h2>

        <p className="mt-5 max-w-xl text-sm leading-7 text-white/72">
          {storefront.description}
        </p>

        <div className="mt-7 flex flex-wrap gap-2">
          {storefront.categories.slice(0, 4).map((category) => (
            <span
              key={category}
              className="border border-white/18 bg-black/20 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.15em] text-white/78 backdrop-blur"
            >
              {category}
            </span>
          ))}
        </div>

        <Link
          href={storefront.route}
          className={`mt-8 inline-flex min-h-12 items-center justify-center px-6 text-[10px] font-extrabold uppercase tracking-[0.2em] transition hover:translate-y-[-2px] ${theme.button}`}
        >
          Enter storefront
        </Link>
      </div>
    </article>
  );
}
