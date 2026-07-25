import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import type { Storefront } from '@/data/storefronts';

interface NigeriaStorePanelProps {
  storefront: Storefront;
  image: string;
  eyebrow: string;
  accent: string;
  className?: string;
  serviceStore?: boolean;
}

export default function NigeriaStorePanel({
  storefront,
  image,
  eyebrow,
  accent,
  className = '',
  serviceStore = false,
}: NigeriaStorePanelProps) {
  return (
    <article
      className={`group relative min-h-[480px] overflow-hidden bg-[#0a1119] ${className}`}
    >
      <Image
        src={image}
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 55vw"
        className="object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-[#05090e] via-black/35 to-black/5" />

      <div className="absolute inset-x-0 bottom-0 z-10 p-7 text-white sm:p-9">
        <div className="mb-7 flex items-center gap-4">
          {storefront.logo ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden border border-white/15 bg-black/50">
              <Image
                src={storefront.logo}
                alt={`${storefront.shortName} logo`}
                fill
                sizes="64px"
                className="object-contain"
              />
            </div>
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center border border-white/20 bg-[#4a102e]/85 font-display text-3xl font-semibold">
              Z
            </div>
          )}

          <div>
            <p
              className="text-[8px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: accent }}
            >
              {eyebrow}
            </p>

            <p className="mt-2 flex items-center gap-2 text-[10px] text-white/55">
              <MapPin size={13} />
              {storefront.locationLabel}
            </p>
          </div>
        </div>

        <h3 className="max-w-2xl font-display text-4xl font-semibold leading-[0.95] sm:text-5xl">
          {storefront.name}
        </h3>

        <p className="mt-5 max-w-xl text-sm leading-7 text-white/66">
          {storefront.description}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {storefront.categories.slice(0, 5).map((category) => (
            <span
              key={category}
              className="border border-white/15 bg-black/25 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.14em] text-white/70 backdrop-blur"
            >
              {category}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link
            href={storefront.route}
            className="inline-flex min-h-12 items-center gap-3 bg-white px-6 text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#0a1119] transition hover:bg-[#5ed0ca]"
          >
            {serviceStore ? 'Products and services' : 'Enter store'}
            <ArrowRight size={15} />
          </Link>

          <a
            href={storefront.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/68 underline decoration-white/25 underline-offset-8 transition hover:text-white"
          >
            WhatsApp support
          </a>
        </div>
      </div>
    </article>
  );
}
