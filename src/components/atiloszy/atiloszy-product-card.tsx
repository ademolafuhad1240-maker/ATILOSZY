import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import {
  formatAtiloszyPrice,
  type AtiloszyProduct,
} from '@/data/atiloszy-store';

interface AtiloszyProductCardProps {
  product: AtiloszyProduct;
}

export default function AtiloszyProductCard({
  product,
}: AtiloszyProductCardProps) {
  return (
    <article className="group min-w-[250px] flex-1 sm:min-w-[285px]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#ded8cc]">
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

        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />

        {product.badge && (
          <span className="absolute left-3 top-3 bg-[#082317] px-3 py-2 text-[8px] font-extrabold uppercase tracking-[0.17em] text-[#e3c873]">
            {product.badge}
          </span>
        )}

        <button
          type="button"
          aria-label={`Save ${product.name}`}
          className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/92 text-[#102219] shadow-lg backdrop-blur transition hover:scale-105"
        >
          <Heart size={17} strokeWidth={1.7} />
        </button>

        <span className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/92 px-3 py-2 text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#102219] backdrop-blur">
          <ShoppingBag size={13} />
          ATILOSZY
        </span>
      </div>

      <div className="pt-4">
        <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-[#8d7136]">
          {product.category}
        </p>

        <Link href={product.href}>
          <h3 className="mt-2 text-[15px] font-bold leading-6 text-[#102219] transition group-hover:text-[#14794d]">
            {product.name}
          </h3>
        </Link>

        <p className="mt-2 text-sm font-extrabold text-[#102219]">
          {formatAtiloszyPrice(product.price)}
        </p>
      </div>
    </article>
  );
}
