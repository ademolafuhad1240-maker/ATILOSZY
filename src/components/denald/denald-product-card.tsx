import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Heart } from 'lucide-react';
import {
  formatDenaldPrice,
  type DenaldProduct,
} from '@/data/denald-store';

interface DenaldProductCardProps {
  product: DenaldProduct;
}

export default function DenaldProductCard({
  product,
}: DenaldProductCardProps) {
  return (
    <article className="group min-w-[250px] flex-1 sm:min-w-[285px]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#d7e0e8]">
        <Link href={product.href} className="absolute inset-0 z-10">
          <span className="sr-only">View {product.name}</span>
        </Link>

        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 78vw, (max-width: 1024px) 40vw, 25vw"
          className="object-cover transition duration-700 group-hover:scale-[1.045]"
        />

        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#06172d]/72 to-transparent" />

        {product.badge && (
          <span className="absolute left-3 top-3 bg-[#071a31] px-3 py-2 text-[8px] font-extrabold uppercase tracking-[0.17em] text-[#f4c642]">
            {product.badge}
          </span>
        )}

        <button
          type="button"
          aria-label={`Save ${product.name}`}
          className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/92 text-[#071a31] shadow-lg backdrop-blur transition hover:scale-105"
        >
          <Heart size={17} strokeWidth={1.7} />
        </button>

        <span className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/92 px-3 py-2 text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#071a31] backdrop-blur">
          DENALD
          <ArrowUpRight size={13} />
        </span>
      </div>

      <div className="pt-4">
        <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#3e648c]">
          {product.category}
        </p>

        <Link href={product.href}>
          <h3 className="mt-2 text-[15px] font-bold leading-6 text-[#071a31] transition group-hover:text-[#1667a4]">
            {product.name}
          </h3>
        </Link>

        <p className="mt-2 text-sm font-extrabold text-[#071a31]">
          {formatDenaldPrice(product.price)}
        </p>
      </div>
    </article>
  );
}
