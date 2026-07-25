import { Headphones, PackageCheck, Sparkles, Store } from 'lucide-react';
import Container from '@/components/ui/container';

const benefits = [
  {
    icon: Sparkles,
    title: 'Thoughtfully selected',
    description: 'A considered collection built around usefulness, presentation and everyday value.',
  },
  {
    icon: Store,
    title: 'Physical and online',
    description: 'A unified ATILOSZY experience designed to serve customers wherever they shop.',
  },
  {
    icon: PackageCheck,
    title: 'Clear product details',
    description: 'Useful information to help you choose the right item with confidence.',
  },
  {
    icon: Headphones,
    title: 'Helpful support',
    description: 'Human assistance when you need information about an item or an order.',
  },
];

export default function BenefitsSection() {
  return (
    <section className="border-y border-black/10 bg-[#fbf8f1] py-16">
      <Container>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ icon: Icon, title, description }) => (
            <div key={title}>
              <Icon size={23} strokeWidth={1.4} className="text-[#a4813d]" />
              <h3 className="mt-5 font-display text-2xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#73766f]">{description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
