import Container from '@/components/ui/container';

const benefits = [
  {
    title: 'Carefully Curated',
    description: 'Every product is thoughtfully selected to meet our high standards of quality and design.',
  },
  {
    title: 'Quality Assured',
    description: 'We partner with trusted brands and makers to bring you the best selections.',
  },
  {
    title: 'Fast Shipping',
    description: 'Get your items delivered quickly with reliable shipping to your doorstep.',
  },
  {
    title: 'Satisfied Customers',
    description: 'Your satisfaction is our priority. We stand behind every product we sell.',
  },
];

export default function BenefitsSection() {
  return (
    <section className="py-16 md:py-24 bg-emerald-dark text-cream-off">
      <Container>
        <h2 className="text-4xl font-bold text-center mb-12">Why Choose ATILOSZY</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {benefits.map((benefit, index) => (
            <div key={index} className="p-6 bg-emerald-rich rounded-sm">
              <h3 className="text-xl font-bold mb-2 text-gold-soft">{benefit.title}</h3>
              <p className="text-cream-warm">{benefit.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
