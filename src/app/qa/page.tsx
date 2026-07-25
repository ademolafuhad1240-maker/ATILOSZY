import type { Metadata } from 'next';
import RegionPage from '@/components/sorvyra/region-page';

export const metadata: Metadata = {
  title: 'Qatar Store',
  description: 'Shop Zee COMFORT HUB across Qatar.',
};

export default function QatarPage() {
  return (
    <RegionPage
      regionCode="qa"
      title="SORVYRA STORE Qatar"
      description="Shop Zee COMFORT HUB for underwear, sleepwear, loungewear and everyday comfort essentials with pickup in Doha and delivery across Qatar."
      currency="Qatari riyal (QAR)"
      flag="🇶🇦"
    />
  );
}
