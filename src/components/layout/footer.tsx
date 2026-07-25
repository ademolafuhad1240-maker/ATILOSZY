import Image from 'next/image';
import Link from 'next/link';
import Container from '@/components/ui/container';

export default function Footer() {
  return (
    <footer className="bg-[#050a13] text-white">
      <Container>
        <div className="grid gap-14 py-20 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="relative h-52 w-52 overflow-hidden">
              <Image
                src="/brand/sorvyra-store-logo.png"
                alt="SORVYRA STORE"
                fill
                sizes="208px"
                className="object-contain"
              />
            </div>

            <p className="mt-5 max-w-md text-sm leading-7 text-white/52">
              The official multi-brand shopping and services platform for
              ATILOSZY, ZEE and DENALD across Nigeria and Qatar.
            </p>
          </div>

          <div>
            <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#d2ad54]">
              Regions
            </h2>
            <div className="mt-6 space-y-4">
              <Link href="/ng" className="block text-sm text-white/58 hover:text-white">
                Nigeria stores
              </Link>
              <Link href="/qa" className="block text-sm text-white/58 hover:text-white">
                Qatar store
              </Link>
            </div>
          </div>

          <div>
            <h2 className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#d2ad54]">
              Storefronts
            </h2>
            <div className="mt-6 space-y-4">
              <Link href="/ng/atiloszy" className="block text-sm text-white/58 hover:text-white">
                ATILOSZY
              </Link>
              <Link
                href="/ng/zee-beauty-fashion"
                className="block text-sm text-white/58 hover:text-white"
              >
                ZEE Beauty & Fashion
              </Link>
              <Link href="/ng/denald" className="block text-sm text-white/58 hover:text-white">
                DENALD
              </Link>
              <Link
                href="/qa/zee-comfort-hub"
                className="block text-sm text-white/58 hover:text-white"
              >
                Zee COMFORT HUB
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-7 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/32 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} SORVYRA STORE</span>
          <span>Nigeria · Qatar</span>
        </div>
      </Container>
    </footer>
  );
}
