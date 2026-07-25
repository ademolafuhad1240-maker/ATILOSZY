import type { Metadata } from 'next';
import RegionPage from '@/components/sorvyra/region-page';

export const metadata: Metadata = {
  title: 'Nigeria Stores',
  description:
    'Shop ATILOSZY, ZEE Beauty & Fashion World and DENALD in Nigeria.',
};

export default function NigeriaPage() {
  return (
    <RegionPage
      regionCode="ng"
      title="SORVYRA STORE Nigeria"
      description="Shop three independently managed Nigerian businesses covering variety products, beauty and fashion, solar power, CCTV and computer solutions."
      currency="Nigerian naira (₦)"
      flag="🇳🇬"
    />
  );
}
