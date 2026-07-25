'use client';

import { useState } from 'react';
import Container from '@/components/ui/container';
import Button from '@/components/ui/button';
import { useCart } from '@/components/cart/cart-provider';
import Link from 'next/link';
import Image from 'next/image';
import { getProductBySlug } from '@/lib/products';
import { formatCurrency } from '@/lib/currency';
import EmptyState from '@/components/ui/empty-state';

export default function CartPage() {
  const { items, removeItem, updateQuantity } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const cartItems = items.map((item) => ({
    ...item,
    product: getProductBySlug(item.productId)!,
  })).filter((item) => item.product);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const tax = subtotal * 0.08; // 8% tax
  const shipping = subtotal > 100 ? 0 : 10;
  const total = subtotal + tax + shipping;

  if (cartItems.length === 0) {
    return (
      <>
        <div className="bg-cream-warm py-12 md:py-16">
          <Container>
            <h1 className="text-4xl font-bold text-charcoal">Shopping Cart</h1>
          </Container>
        </div>
        <section className="py-16 md:py-24">
          <Container>
            <EmptyState
              title="Your cart is empty"
              description="Explore our collection and add some items to get started."
              action={
                <Link href="/shop">
                  <Button variant="primary" size="md">
                    Continue Shopping
                  </Button>
                </Link>
              }
            />
          </Container>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="bg-cream-warm py-12 md:py-16">
        <Container>
          <h1 className="text-4xl font-bold text-charcoal">Shopping Cart</h1>
        </Container>
      </div>

      <section className="py-16 md:py-24">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex gap-4 p-4 border border-border-color rounded-sm hover:shadow-md transition-shadow"
                  >
                    <div className="relative w-24 h-24 bg-cream-warm rounded-sm overflow-hidden flex-shrink-0">
                      <Image
                        src={item.product.image}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="flex-grow">
                      <Link href={`/product/${item.product.slug}`}>
                        <h3 className="font-bold text-charcoal hover:text-emerald-rich transition-colors">
                          {item.product.name}
                        </h3>
                      </Link>
                      <p className="text-sm text-text-muted mb-4">
                        {formatCurrency(item.product.price)} each
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="px-2 py-1 border border-border-color hover:bg-cream-warm transition-colors rounded-sm"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="px-2 py-1 border border-border-color hover:bg-cream-warm transition-colors rounded-sm"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="ml-auto text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-charcoal">
                        {formatCurrency(item.product.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-cream-warm p-6 rounded-sm sticky top-20">
                <h2 className="text-xl font-bold text-charcoal mb-6">Order Summary</h2>

                <div className="space-y-3 mb-6 pb-6 border-b border-border-color">
                  <div className="flex justify-between text-text-muted">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Tax</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Shipping</span>
                    <span>
                      {shipping === 0 ? (
                        <span className="text-emerald-rich font-medium">Free</span>
                      ) : (
                        formatCurrency(shipping)
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                  <span className="font-bold text-charcoal">Total</span>
                  <span className="text-2xl font-bold text-emerald-dark">
                    {formatCurrency(total)}
                  </span>
                </div>

                <Button
                  onClick={() => setIsCheckingOut(true)}
                  variant="primary"
                  size="lg"
                  className="w-full mb-3"
                >
                  Proceed to Checkout
                </Button>
                <Link href="/shop">
                  <Button variant="outline" size="lg" className="w-full">
                    Continue Shopping
                  </Button>
                </Link>

                {shipping === 0 && (
                  <p className="text-xs text-emerald-rich font-medium text-center mt-4">
                    ✓ Free shipping on orders over $100
                  </p>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
