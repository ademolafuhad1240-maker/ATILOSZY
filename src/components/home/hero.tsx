import Image from 'next/image';
import Link from 'next/link';
import Container from '@/components/ui/container';

const floatingProducts = [
  {
    name: 'Beauty',
    image:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&auto=format&fit=crop&q=88',
    position: 'left-0 top-10 md:left-4',
    animation: 'float-product-a',
  },
  {
    name: 'Gadgets',
    image:
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=88',
    position: 'right-0 top-4 md:right-4',
    animation: 'float-product-b',
  },
  {
    name: 'Accessories',
    image:
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=88',
    position: 'bottom-4 left-3 md:left-10',
    animation: 'float-product-c',
  },
  {
    name: 'Home',
    image:
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=88',
    position: 'bottom-8 right-0 md:right-8',
    animation: 'float-product-d',
  },
];

export default function Hero() {
  return (
    <section className="hero-living-background relative overflow-hidden bg-[#020604] text-[#fbf8f1]">
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />

      <Container>
        <div className="grid min-h-[760px] items-center gap-12 py-20 lg:grid-cols-[0.92fr_1.08fr] lg:py-24">
          <div className="relative z-20">
            <div className="mb-8 flex items-center gap-4">
              <span className="h-px w-10 bg-[#d4af5f]" />
              <p className="text-[10px] font-extrabold uppercase tracking-[0.34em] text-[#d4af5f]">
                Premium variety, thoughtfully chosen
              </p>
            </div>

            <h1 className="max-w-3xl font-display text-[62px] font-medium leading-[0.9] tracking-[-0.04em] sm:text-[78px] lg:text-[94px]">
              One store.
              <br />
              <span className="text-[#d4af5f]">Many good finds.</span>
            </h1>

            <p className="mt-8 max-w-xl text-base leading-8 text-white/68 sm:text-lg">
              Explore useful and beautiful finds across home, beauty,
              accessories, gadgets, gifts and everyday essentials.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/shop"
                className="premium-shine-button inline-flex min-h-14 items-center justify-center overflow-hidden bg-[#d4af5f] px-9 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#10231b]"
              >
                Explore the store
              </Link>

              <Link
                href="/about"
                className="inline-flex min-h-14 items-center justify-center border border-white/25 px-9 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white transition hover:border-[#d4af5f] hover:text-[#d4af5f]"
              >
                Our story
              </Link>
            </div>

            <div className="mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-white/12 pt-7">
              <div>
                <p className="font-display text-3xl text-[#d4af5f]">06</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-white/48">
                  Main categories
                </p>
              </div>
              <div>
                <p className="font-display text-3xl text-[#d4af5f]">₦</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-white/48">
                  Naira pricing
                </p>
              </div>
              <div>
                <p className="font-display text-3xl text-[#d4af5f]">NG</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-white/48">
                  Built for Nigeria
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 min-h-[560px] lg:min-h-[650px]">
            <div className="absolute inset-10 rounded-full bg-[#0a5a37]/18 blur-3xl" />

            <div className="logo-breathe absolute left-1/2 top-1/2 z-20 h-[365px] w-[365px] -translate-x-1/2 -translate-y-1/2 sm:h-[455px] sm:w-[455px]">
              <Image
                src="/brand/atiloszy-logo-original.png"
                alt="Atiloszy Varieties Store"
                fill
                priority
                sizes="(max-width: 640px) 365px, 455px"
                className="object-contain drop-shadow-[0_0_40px_rgba(0,255,128,0.12)]"
              />
            </div>

            {floatingProducts.map((product) => (
              <div
                key={product.name}
                className={`${product.position} ${product.animation} absolute z-30 w-[122px] border border-white/15 bg-black/75 p-2 shadow-2xl backdrop-blur sm:w-[145px]`}
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src={product.image}
                    alt=""
                    fill
                    sizes="145px"
                    className="object-cover"
                  />
                </div>
                <p className="py-3 text-center text-[8px] font-extrabold uppercase tracking-[0.24em] text-[#e3c679]">
                  {product.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
