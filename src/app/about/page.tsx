import type { Metadata } from 'next';
import Container from '@/components/ui/container';
import SectionHeading from '@/components/ui/section-heading';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about ATILOSZY and our mission to bring thoughtfully curated products to you.',
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-emerald-dark text-cream-off py-16 md:py-24">
        <Container>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">About ATILOSZY</h1>
          <p className="text-xl text-cream-warm max-w-2xl">
            We believe that everyday products should be both useful and beautiful. That&apos;s why we carefully curate every item in our collection.
          </p>
        </Container>
      </section>

      {/* Mission */}
      <section className="py-16 md:py-24">
        <Container>
          <div className="max-w-3xl">
            <h2 className="text-4xl font-bold text-charcoal mb-6">Our Mission</h2>
            <p className="text-lg text-text-muted mb-6 leading-relaxed">
              ATILOSZY exists to simplify the way you shop for everyday items. We partner with trusted brands and makers to bring you a thoughtfully selected collection of products that add real value to your life.
            </p>
            <p className="text-lg text-text-muted mb-6 leading-relaxed">
              Every product in our store is chosen with care—we look for quality, design, and functionality. We believe that good things don&apos;t have to be complicated, and that&apos;s reflected in everything we do.
            </p>
            <p className="text-lg text-text-muted leading-relaxed">
              As a proud SORVYRA Brand, we&apos;re committed to excellence and customer satisfaction in every interaction.
            </p>
          </div>
        </Container>
      </section>

      {/* Values */}
      <section className="py-16 md:py-24 bg-cream-warm">
        <Container>
          <SectionHeading
            title="Our Values"
            subtitle="What we stand for"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="p-8 bg-white rounded-sm border border-border-color">
              <h3 className="text-2xl font-bold text-emerald-rich mb-4">Quality First</h3>
              <p className="text-text-muted">
                We don&apos;t compromise on quality. Every product meets our high standards before it reaches you.
              </p>
            </div>
            <div className="p-8 bg-white rounded-sm border border-border-color">
              <h3 className="text-2xl font-bold text-emerald-rich mb-4">Customer Focused</h3>
              <p className="text-text-muted">
                Your satisfaction is our top priority. We&apos;re here to help and make your experience exceptional.
              </p>
            </div>
            <div className="p-8 bg-white rounded-sm border border-border-color">
              <h3 className="text-2xl font-bold text-emerald-rich mb-4">Thoughtful Selection</h3>
              <p className="text-text-muted">
                We carefully curate every item. Each product is chosen for its value and contribution to your daily life.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Team */}
      <section className="py-16 md:py-24">
        <Container>
          <SectionHeading
            title="Meet the Team"
            subtitle="Passionate about finding great products for you"
          />
          <p className="text-center text-text-muted max-w-2xl mx-auto mt-8">
            The ATILOSZY team is dedicated to bringing you the best selection of everyday products. We&apos;re constantly searching for new finds and listening to your feedback to improve your shopping experience.
          </p>
        </Container>
      </section>
    </>
  );
}
