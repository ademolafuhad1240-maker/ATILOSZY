import type { Metadata } from 'next';
import StorefrontShell from '@/components/sorvyra/storefront-shell';
import { getStorefront } from '@/data/storefronts';

export const metadata: Metadata = {
  title: 'ZEE Beauty & Fashion World',
  description:
    'Beauty, fashion, personal care, household items and essentials in Osogbo.',
};

export default function ZeeBeautyFashionPage() {
  return <StorefrontShell storefront={getStorefront('zee-beauty-fashion')} />;
}
