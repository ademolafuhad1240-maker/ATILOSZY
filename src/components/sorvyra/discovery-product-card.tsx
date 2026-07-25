import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import {
  formatDiscoveryPrice,
  type DiscoveryProduct,
} from '@/data/sorvyra-discovery';

interface DiscoveryProductCardProps {
  product: DiscoveryProduct;
}

export default function DiscoveryProductCard({
  product,
}: DiscoveryProductCardProps) {
  return (
    <article className="group min-w-[250px] flex-1 sm:min-w-[280px]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#d8d2c7]">
        <Link href={product.href} className="absolute inset-0 z-10">
          <span className="sr-only">View {product.name}</span>
        </Link>

        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 78vw, (max-width: 1024px) 38vw, 25vw"
          className="object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
        />

        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/42 to-transparent" />

        {product.badge && (
          <span className="absolute left-3 top-3 bg-[#0a1119] px-3 py-2 text-[8px] font-extrabold uppercase tracking-[0.17em] text-white">
            {product.badge}
          </span>
        )}

        <button
          type="button"
          aria-label={`Save ${product.name}`}
          className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#101820] shadow-lg backdrop-blur transition hover:scale-105"
        >
          <Heart size={17} strokeWidth={1.7} />
        </button>

        <div className="absolute bottom-3 left-3 flex gap-2">
          <span className="bg-white/90 px-3 py-2 text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#111820] backdrop-blur">
            {product.country}
          </span>
          <span className="bg-[#d4ad55] px-3 py-2 text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#101820]">
            {product.currency}
          </span>
        </div>
      </div>

      <div className="pt-4">
        <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#756036]">
          {product.store}
        </p>

        <Link href={product.href}>
          <h3 className="mt-2 text-[15px] font-bold leading-6 text-[#111820] transition group-hover:text-[#087f83]">
            {product.name}
          </h3>
        </Link>

        <p className="mt-2 text-sm font-extrabold text-[#111820]">
          {formatDiscoveryPrice(product.price, product.currency)}
        </p>
      </div>
    </article>
  );
}
