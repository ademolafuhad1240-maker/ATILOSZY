import type { Metadata } from 'next';
import Container from '@/components/ui/container';
import ProductGrid from '@/components/commerce/product-grid';
import SectionHeading from '@/components/ui/section-heading';
import { products } from '@/data/products';

export const metadata: Metadata = {
  title: 'Shop All Products',
  description: 'Browse our complete collection of thoughtfully curated products.',
};

export default function ShopPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-cream-warm py-12 md:py-16">
        <Container>
          <SectionHeading
            title="Shop All Products"
            subtitle="Discover our complete collection of curated items"
          />
        </Container>
      </section>

      {/* Products */}
      <section className="py-16 md:py-24">
        <Container>
          <ProductGrid products={products} />
        </Container>
      </section>
    </>
  );
}
