import Image from 'next/image';
import Link from 'next/link';
import ProductPrice from '@/components/commerce/product-price';
import AddToCartButton from '@/components/cart/add-to-cart-button';
import type { Product } from '@/types/commerce';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.inventoryStatus === 'out_of_stock';

  return (
    <article className="group flex h-full flex-col">
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden bg-[#eee8dc]"
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
        />

        {product.badge && (
          <span className="absolute left-4 top-4 bg-[#fbf8f1] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#171815]">
            {product.badge}
          </span>
        )}

        <span className="absolute inset-x-4 bottom-4 translate-y-4 bg-[#fbf8f1]/95 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[#171815] opacity-0 shadow-xl backdrop-blur transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          View product
        </span>
      </Link>

      <div className="flex flex-1 flex-col pt-5">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#9b7c3d]">
          {product.categorySlug.split('-').join(' ')}
        </p>

        <Link href={`/product/${product.slug}`}>
          <h3 className="font-display text-2xl font-semibold leading-tight text-[#171815] transition-colors group-hover:text-[#896b32]">
            {product.name}
          </h3>
        </Link>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#74766f]">
          {product.shortDescription}
        </p>

        <div className="mt-4">
          <ProductPrice price={product.price} compareAtPrice={product.compareAtPrice} />
        </div>

        {product.inventoryStatus === 'low_stock' && (
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9b6538]">
            Limited availability
          </p>
        )}

        <div className="mt-5">
          <AddToCartButton product={product} disabled={isOutOfStock} />
        </div>
      </div>
    </article>
  );
}
