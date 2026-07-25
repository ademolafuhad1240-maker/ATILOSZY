import Link from 'next/link';
import Container from '@/components/ui/container';
import { categories } from '@/data/categories';

export default function CategoriesSection() {
  return (
    <section className="bg-[#eee7da] py-24 md:py-32">
      <Container>
        <div className="mb-14 max-w-xl">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.32em] text-[#8c6d34]">
            Browse the collection
          </p>
          <h2 className="font-display text-5xl font-semibold leading-none tracking-[-0.03em] md:text-7xl">
            Find your everyday favourites.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className={`group relative min-h-[430px] overflow-hidden ${
                index === 0 ? 'lg:col-span-2' : ''
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-[1.04]"
                style={{ backgroundImage: `url(${category.image})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-7 text-white md:p-9">
                <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[#e5c986]">
                  Collection {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-3 font-display text-4xl font-semibold leading-none">
                  {category.name}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/75">
                  {category.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
