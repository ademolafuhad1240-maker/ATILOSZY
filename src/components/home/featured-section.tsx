import Container from '@/components/ui/container';
import SectionHeading from '@/components/ui/section-heading';
import ProductGrid from '@/components/commerce/product-grid';
import { getFeaturedProducts } from '@/lib/products';
import Link from 'next/link';
import Button from '@/components/ui/button';

export default function FeaturedSection() {
  const products = getFeaturedProducts();

  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="mb-12">
          <SectionHeading
            title="Featured Collection"
            subtitle="Handpicked items that stand out"
          />
        </div>
        <ProductGrid products={products} />
        <div className="mt-12 text-center">
          <Link href="/shop">
            <Button variant="primary" size="lg">
              View All Products
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}
