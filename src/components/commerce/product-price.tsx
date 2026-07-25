import { formatPrice } from '@/lib/currency';

interface ProductPriceProps {
  price: number;
  compareAtPrice?: number | null;
}

export default function ProductPrice({
  price,
  compareAtPrice,
}: ProductPriceProps) {
  const hasDiscount = compareAtPrice != null && compareAtPrice > price;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-bold tracking-tight text-[#171815]">
        {formatPrice(price)}
      </span>
      {hasDiscount && (
        <span className="text-xs text-[#8a8c85] line-through">
          {formatPrice(compareAtPrice)}
        </span>
      )}
    </div>
  );
}
