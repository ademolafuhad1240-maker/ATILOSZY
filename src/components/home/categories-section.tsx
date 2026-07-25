import Container from '@/components/ui/container';
import Link from 'next/link';
import { categories } from '@/data/categories';

export default function CategoriesSection() {
  return (
    <section className="py-16 md:py-24">
      <Container>
        <h2 className="text-4xl font-bold text-center mb-12 text-charcoal">Shop by Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="group relative overflow-hidden rounded-sm h-64 flex items-end p-6 bg-gradient-to-b from-transparent to-charcoal/50 hover:to-charcoal/70 transition-all duration-300"
            >
              <div
                className="absolute inset-0 bg-cover bg-center group-hover:scale-110 transition-transform duration-300"
                style={{ backgroundImage: `url(${category.image})` }}
              />
              <div className="absolute inset-0 bg-charcoal/20 group-hover:bg-charcoal/40 transition-colors duration-300" />
              <div className="relative z-10">
                <h3 className="text-white text-2xl font-bold mb-2">{category.name}</h3>
                <p className="text-cream-warm text-sm">{category.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
