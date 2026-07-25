import Hero from '@/components/home/hero';
import FeaturedSection from '@/components/home/featured-section';
import CategoriesSection from '@/components/home/categories-section';
import NewArrivalsSection from '@/components/home/new-arrivals-section';
import BenefitsSection from '@/components/home/benefits-section';

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturedSection />
      <CategoriesSection />
      <NewArrivalsSection />
      <BenefitsSection />
    </>
  );
}
