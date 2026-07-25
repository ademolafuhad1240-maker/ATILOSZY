import type { Metadata } from 'next';
import StorefrontShell from '@/components/sorvyra/storefront-shell';
import { getStorefront } from '@/data/storefronts';

export const metadata: Metadata = {
  title: 'DENALD Solar | CCTV | Computer',
  description:
    'Shop solar products, CCTV and computer solutions and request professional installation services.',
};

export default function DenaldPage() {
  return <StorefrontShell storefront={getStorefront('denald')} serviceStore />;
}
