import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Container from '@/components/ui/container';
import SectionHeading from '@/components/ui/section-heading';
import ProductGrid from '@/components/commerce/product-grid';
import { getCategoryBySlug, getProductsByCategory } from '@/lib/products';

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const category = getCategoryBySlug(params.slug);

  if (!category) {
    return {};
  }

  return {
    title: category.name,
    description: category.description,
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const category = getCategoryBySlug(params.slug);

  if (!category) {
    notFound();
  }

  const products = getProductsByCategory(params.slug);

  return (
    <>
      {/* Hero */}
      <section className="bg-cream-warm py-12 md:py-16">
        <Container>
          <SectionHeading title={category.name} subtitle={category.description} />
        </Container>
      </section>

      {/* Products */}
      <section className="py-16 md:py-24">
        <Container>
          {products.length > 0 ? (
            <ProductGrid products={products} />
          ) : (
            <div className="text-center py-12">
              <h3 className="text-2xl font-bold text-charcoal mb-4">
                No products in this category yet
              </h3>
              <p className="text-text-muted">Check back soon for new items.</p>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
