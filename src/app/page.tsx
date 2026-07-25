import Hero from '@/components/home/hero';
import CategoryMarquee from '@/components/home/category-marquee';
import FeaturedSection from '@/components/home/featured-section';
import CategoriesSection from '@/components/home/categories-section';
import StorySection from '@/components/home/story-section';
import NewArrivalsSection from '@/components/home/new-arrivals-section';
import BenefitsSection from '@/components/home/benefits-section';
import NewsletterSection from '@/components/home/newsletter-section';

export default function Home() {
  return (
    <>
      <Hero />
      <CategoryMarquee />
      <FeaturedSection />
      <CategoriesSection />
      <StorySection />
      <NewArrivalsSection />
      <BenefitsSection />
      <NewsletterSection />
    </>
  );
}
