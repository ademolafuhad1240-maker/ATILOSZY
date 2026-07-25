import Image from 'next/image';
import Link from 'next/link';
import Container from '@/components/ui/container';

const shopLinks = [
  'Home & Living',
  'Beauty & Personal Care',
  'Fashion Accessories',
  'Electronics & Gadgets',
  'Kids & Gifts',
  'Everyday Essentials',
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#020604] text-white">
      <Container>
        <div className="grid gap-14 py-20 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="relative h-48 w-48">
              <Image
                src="/brand/atiloszy-logo-original.png"
                alt="Atiloszy Varieties Store"
                fill
                sizes="192px"
                className="object-contain"
              />
            </div>

            <p className="mt-5 max-w-md text-sm leading-7 text-white/55">
              A premium Nigerian variety store bringing useful, beautiful
              and thoughtfully selected products together under one brand.
            </p>
          </div>

          <div>
            <h2 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#d4af5f]">
              Shop
            </h2>
            <div className="mt-6 space-y-3">
              {shopLinks.map((label) => (
                <Link
                  key={label}
                  href="/shop"
                  className="block text-sm text-white/62 transition hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#d4af5f]">
              ATILOSZY
            </h2>
            <div className="mt-6 space-y-3">
              <Link href="/about" className="block text-sm text-white/62 hover:text-white">
                Our Story
              </Link>
              <Link href="/contact" className="block text-sm text-white/62 hover:text-white">
                Contact
              </Link>
              <Link href="/cart" className="block text-sm text-white/62 hover:text-white">
                Shopping Bag
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-7 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} ATILOSZY</span>
          <span>A SORVYRA Brand · Nigeria</span>
        </div>
      </Container>
    </footer>
  );
}
