import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Container from '@/components/ui/container';
import ProductPrice from '@/components/commerce/product-price';
import AddToCartButton from '@/components/cart/add-to-cart-button';
import Badge from '@/components/ui/badge';
import { getProductBySlug, getProductsByCategory } from '@/lib/products';
import Link from 'next/link';
import ProductGrid from '@/components/commerce/product-grid';

interface ProductPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const product = getProductBySlug(params.slug);

  if (!product) {
    return {};
  }

  return {
    title: product.name,
    description: product.shortDescription,
  };
}

export default function ProductPage({ params }: ProductPageProps) {
  const product = getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = getProductsByCategory(product.categorySlug)
    .filter((p) => p.id !== product.id)
    .slice(0, 3);

  return (
    <>
      {/* Product Section */}
      <section className="py-12 md:py-16">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Images */}
            <div>
              <div className="relative aspect-square bg-cream-warm rounded-sm overflow-hidden mb-4">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                />
                {product.badge && (
                  <div className="absolute top-4 left-4">
                    <Badge variant={product.compareAtPrice ? 'sale' : 'default'}>
                      {product.badge}
                    </Badge>
                  </div>
                )}
              </div>
              {product.secondaryImages && product.secondaryImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {product.secondaryImages.map((image, index) => (
                    <div key={index} className="relative aspect-square bg-cream-warm rounded-sm overflow-hidden">
                      <Image
                        src={image}
                        alt={`${product.name} view ${index + 2}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div>
              <Link href={`/category/${product.categorySlug}`} className="text-sm text-emerald-rich hover:text-emerald-dark mb-4 inline-block">
                ← Back to {product.categorySlug.replace(/-/g, ' ')}
              </Link>
              
              <h1 className="text-4xl font-bold text-charcoal mb-4">{product.name}</h1>
              
              <div className="mb-6">
                <ProductPrice price={product.price} compareAtPrice={product.compareAtPrice} />
              </div>

              <p className="text-lg text-text-muted mb-8">{product.description}</p>

              {/* Inventory Status */}
              <div className="mb-8 p-4 bg-cream-warm rounded-sm">
                {product.inventoryStatus === 'in_stock' && (
                  <p className="text-emerald-rich font-medium">✓ In stock - Ready to ship</p>
                )}
                {product.inventoryStatus === 'low_stock' && (
                  <p className="text-gold-warm font-medium">⚠ Low stock - Order soon</p>
                )}
                {product.inventoryStatus === 'out_of_stock' && (
                  <p className="text-red-600 font-medium">Out of stock - Check back later</p>
                )}
              </div>

              {/* Fulfillment Info */}
              <div className="mb-8 text-sm text-text-muted">
                <p className="mb-2">
                  <span className="font-medium">Fulfillment:</span>{' '}
                  {product.fulfillmentType === 'store_inventory' && 'Ships from our store'}
                  {product.fulfillmentType === 'online_inventory' && 'Ships from our warehouse'}
                  {product.fulfillmentType === 'partner_fulfilled' && 'Partner fulfilled'}
                </p>
              </div>

              {/* Add to Cart */}
              <div className="mb-8">
                <AddToCartButton
                  product={product}
                  disabled={product.inventoryStatus === 'out_of_stock'}
                />
              </div>

              {/* Additional Info */}
              <div className="border-t border-border-color pt-8">
                <h3 className="font-bold text-charcoal mb-4">About this item</h3>
                <ul className="space-y-2 text-sm text-text-muted">
                  <li>✓ Carefully selected for quality</li>
                  <li>✓ Ships to your door</li>
                  <li>✓ Customer satisfaction guaranteed</li>
                </ul>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="py-16 md:py-24 bg-cream-warm">
          <Container>
            <h2 className="text-3xl font-bold text-charcoal mb-12">Related Products</h2>
            <ProductGrid products={relatedProducts} />
          </Container>
        </section>
      )}
    </>
  );
}
