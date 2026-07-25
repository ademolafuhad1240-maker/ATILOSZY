import Container from '@/components/ui/container';
import SectionHeading from '@/components/ui/section-heading';
import ProductGrid from '@/components/commerce/product-grid';
import { getNewArrivals } from '@/lib/products';

export default function NewArrivalsSection() {
  const products = getNewArrivals();

  return (
    <section className="py-16 md:py-24 bg-cream-warm">
      <Container>
        <div className="mb-12">
          <SectionHeading
            title="New Arrivals"
            subtitle="Fresh finds, recently added"
          />
        </div>
        <ProductGrid products={products} />
      </Container>
    </section>
  );
}
