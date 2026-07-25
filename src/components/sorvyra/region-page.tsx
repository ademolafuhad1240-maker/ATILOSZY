import Link from 'next/link';
import StorefrontCard from '@/components/sorvyra/storefront-card';
import {
  getStorefrontsByRegion,
  type RegionCode,
} from '@/data/storefronts';

interface RegionPageProps {
  regionCode: RegionCode;
  title: string;
  description: string;
  currency: string;
  flag: string;
}

export default function RegionPage({
  regionCode,
  title,
  description,
  currency,
  flag,
}: RegionPageProps) {
  const regionStorefronts = getStorefrontsByRegion(regionCode);

  return (
    <>
      <section className="relative overflow-hidden bg-[#050a13] px-5 py-24 text-white md:py-32">
        <div className="sorvyra-region-orb absolute right-[-100px] top-[-120px] h-[360px] w-[360px] rounded-full bg-[#0e8b93]/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/"
            className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#c8a950]"
          >
            ← SORVYRA STORE
          </Link>

          <p className="mt-12 text-4xl" aria-hidden="true">
            {flag}
          </p>

          <h1 className="mt-6 max-w-4xl font-display text-6xl font-semibold leading-[0.9] tracking-[-0.04em] md:text-8xl">
            {title}
          </h1>

          <p className="mt-8 max-w-2xl text-base leading-8 text-white/62 md:text-lg">
            {description}
          </p>

          <div className="mt-10 inline-flex border border-white/15 bg-white/5 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
            Store currency: {currency}
          </div>
        </div>
      </section>

      <section className="bg-[#f6f3ec] px-5 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#997b35]">
              Choose a store
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-none tracking-[-0.03em] text-[#111814] md:text-6xl">
              Shop from a business you know.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {regionStorefronts.map((storefront, index) => (
              <StorefrontCard
                key={storefront.id}
                storefront={storefront}
                featured={regionStorefronts.length > 2 && index === 0}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
