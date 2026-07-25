import Image from 'next/image';
import Link from 'next/link';
import Badge from '@/components/ui/badge';
import ProductPrice from '@/components/commerce/product-price';
import AddToCartButton from '@/components/cart/add-to-cart-button';
import type { Product } from '@/types/commerce';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.inventoryStatus === 'out_of_stock';

  return (
    <div className="flex flex-col h-full bg-cream-off border border-border-color rounded-sm overflow-hidden hover:shadow-lg transition-shadow duration-200">
      {/* Image Container */}
      <Link href={`/product/${product.slug}`} className="relative w-full aspect-square bg-cream-warm overflow-hidden group">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.badge && (
          <div className="absolute top-4 left-4 z-10">
            <Badge variant={product.compareAtPrice ? 'sale' : 'default'}>
              {product.badge}
            </Badge>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-grow p-4">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-bold text-lg text-charcoal hover:text-emerald-rich transition-colors mb-2">
            {product.name}
          </h3>
        </Link>
        <p className="text-sm text-text-muted mb-4 flex-grow">{product.shortDescription}</p>

        {/* Price */}
        <div className="mb-4">
          <ProductPrice price={product.price} compareAtPrice={product.compareAtPrice} />
        </div>

        {/* Inventory Status */}
        <div className="text-xs text-text-muted mb-4">
          {product.inventoryStatus === 'in_stock' && (
            <span className="text-emerald-rich font-medium">In stock</span>
          )}
          {product.inventoryStatus === 'low_stock' && (
            <span className="text-gold-warm font-medium">Low stock</span>
          )}
          {product.inventoryStatus === 'out_of_stock' && (
            <span className="text-red-600 font-medium">Out of stock</span>
          )}
        </div>

        {/* Add to Cart */}
        <AddToCartButton product={product} disabled={isOutOfStock} />
      </div>
    </div>
  );
}
