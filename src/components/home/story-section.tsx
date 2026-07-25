import Link from 'next/link';
import Container from '@/components/ui/container';

export default function StorySection() {
  return (
    <section className="bg-[#0f2e24] py-24 text-[#f8f3e8] md:py-32">
      <Container>
        <div className="grid gap-16 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-[#d0ae68]">
              Our point of view
            </p>
            <p className="mt-8 font-display text-4xl font-medium leading-[1.05] text-white/70">
              Good design belongs in everyday life—not only on special occasions.
            </p>
          </div>

          <div>
            <h2 className="font-display text-5xl font-semibold leading-[0.98] tracking-[-0.03em] md:text-7xl">
              More than a variety store.
            </h2>
            <p className="mt-8 max-w-2xl text-base leading-8 text-[#c7cec9]">
              ATILOSZY brings useful, attractive and carefully considered products
              together under one trusted Nigerian retail brand. Every collection is
              presented with the same attention to detail.
            </p>
            <Link
              href="/about"
              className="mt-9 inline-flex border-b border-[#d0ae68] pb-2 text-[10px] font-bold uppercase tracking-[0.22em]"
            >
              Read the ATILOSZY story
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
