import Container from '@/components/ui/container';
import Button from '@/components/ui/button';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-emerald-dark to-emerald-rich text-cream-off py-20 md:py-32">
      <Container>
        <div className="max-w-2xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Everyday finds, thoughtfully chosen.
          </h1>
          <p className="text-xl text-cream-warm mb-8 leading-relaxed">
            Discover useful, beautiful and carefully selected products that add value to your daily life—all in one trusted store.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/shop">
              <Button variant="secondary" size="lg">
                Shop Now
              </Button>
            </Link>
            <Link href="/about">
              <Button variant="outline" size="lg">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
