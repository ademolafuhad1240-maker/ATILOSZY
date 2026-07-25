import Link from 'next/link';
import Container from '@/components/ui/container';
import ProductGrid from '@/components/commerce/product-grid';
import { getFeaturedProducts } from '@/lib/products';

export default function FeaturedSection() {
  const products = getFeaturedProducts();

  return (
    <section className="bg-[#fbf8f1] py-24 md:py-32">
      <Container>
        <div className="mb-14 flex flex-col justify-between gap-8 border-b border-black/10 pb-10 md:flex-row md:items-end">
          <div>
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.32em] text-[#9b7c3d]">
              Curated for you
            </p>
            <h2 className="max-w-2xl font-display text-5xl font-semibold leading-[0.95] tracking-[-0.03em] md:text-7xl">
              Pieces worth noticing.
            </h2>
          </div>

          <Link
            href="/shop"
            className="text-[10px] font-bold uppercase tracking-[0.2em] underline decoration-[#b79145] underline-offset-8"
          >
            View the complete collection
          </Link>
        </div>

        <ProductGrid products={products} />
      </Container>
    </section>
  );
}
