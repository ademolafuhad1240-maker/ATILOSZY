'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import { useCart } from '@/components/cart/cart-provider';
import type { Product } from '@/types/commerce';

interface AddToCartButtonProps {
  product: Product;
  disabled?: boolean;
}

export default function AddToCartButton({
  product,
  disabled = false,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addItem(product.id, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          className="px-3 py-2 border border-border-color hover:bg-cream-warm transition-colors rounded-sm"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="flex-1 text-center border border-border-color px-3 py-2 rounded-sm"
          aria-label="Quantity"
        />
        <button
          onClick={() => setQuantity(quantity + 1)}
          className="px-3 py-2 border border-border-color hover:bg-cream-warm transition-colors rounded-sm"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <Button
        onClick={handleAddToCart}
        disabled={disabled}
        variant="primary"
        size="md"
        className="w-full"
      >
        {added ? '✓ Added' : 'Add to Cart'}
      </Button>
    </div>
  );
}
