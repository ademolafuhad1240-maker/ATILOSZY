import { formatPrice } from '@/lib/currency';

interface ProductPriceProps {
  price: number;
  compareAtPrice?: number;
}

export default function ProductPrice({ price, compareAtPrice }: ProductPriceProps) {
  const showSalePrice = compareAtPrice && compareAtPrice > price;

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-bold text-charcoal">{formatPrice(price)}</span>
      {showSalePrice && (
        <span className="text-sm text-text-muted line-through">{formatPrice(compareAtPrice)}</span>
      )}
    </div>
  );
}
