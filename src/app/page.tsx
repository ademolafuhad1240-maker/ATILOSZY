import Image from 'next/image';
import Link from 'next/link';
import StorefrontCard from '@/components/sorvyra/storefront-card';
import { storefronts } from '@/data/storefronts';

export default function Home() {
  return (
    <>
      <section className="sorvyra-master-hero relative overflow-hidden bg-[#050a13] px-5 py-20 text-white md:py-28">
        <div className="sorvyra-orb sorvyra-orb-one" />
        <div className="sorvyra-orb sorvyra-orb-two" />

        <div className="relative mx-auto grid min-h-[650px] max-w-7xl items-center gap-14 lg:grid-cols-[1fr_0.88fr]">
          <div>
            <div className="flex items-center gap-4">
              <span className="h-px w-12 bg-[#cfae58]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-[#cfae58]">
                The official SORVYRA commerce platform
              </p>
            </div>

            <h1 className="mt-9 max-w-4xl font-display text-[64px] font-semibold leading-[0.86] tracking-[-0.045em] sm:text-[82px] lg:text-[100px]">
              Different stores.
              <br />
              <span className="text-[#4cc3b8]">One trusted world.</span>
            </h1>

            <p className="mt-9 max-w-2xl text-base leading-8 text-white/62 md:text-lg">
              Shop everyday products, beauty and fashion, comfort essentials,
              solar equipment and professional technology services across
              Nigeria and Qatar.
            </p>

            <div className="mt-11 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/ng"
                className="inline-flex min-h-14 items-center justify-center bg-[#cfae58] px-9 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#07131d] transition hover:translate-y-[-2px]"
              >
                Shop Nigeria
              </Link>
              <Link
                href="/qa"
                className="inline-flex min-h-14 items-center justify-center border border-white/22 px-9 text-[10px] font-extrabold uppercase tracking-[0.2em] transition hover:border-[#4cc3b8] hover:text-[#4cc3b8]"
              >
                Shop Qatar
              </Link>
            </div>
          </div>

          <div className="relative mx-auto h-[480px] w-full max-w-[480px]">
            <div className="sorvyra-logo-pulse absolute inset-0">
              <Image
                src="/brand/sorvyra-store-logo.png"
                alt="SORVYRA STORE"
                fill
                priority
                sizes="480px"
                className="object-contain drop-shadow-[0_30px_80px_rgba(19,194,182,0.16)]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f3ec] px-5 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#96782e]">
                Owned SORVYRA businesses
              </p>
              <h2 className="mt-5 max-w-4xl font-display text-5xl font-semibold leading-[0.93] tracking-[-0.03em] text-[#111814] md:text-7xl">
                Choose the store that fits what you need today.
              </h2>
            </div>

            <p className="max-w-xl text-sm leading-7 text-black/55">
              Every store keeps its own identity, catalogue, support number,
              cart, account and checkout while operating under the wider
              SORVYRA STORE platform.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {storefronts.map((storefront, index) => (
              <StorefrontCard
                key={storefront.id}
                storefront={storefront}
                featured={index === 0}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0a1522] px-5 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-3">
          <div>
            <p className="font-display text-5xl text-[#cfae58]">04</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
              Branded operations
            </p>
          </div>
          <div>
            <p className="font-display text-5xl text-[#4cc3b8]">02</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
              Countries
            </p>
          </div>
          <div>
            <p className="font-display text-5xl text-[#cfae58]">NGN · QAR</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
              Separate regional currencies
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
