import type { Metadata } from 'next';
import StorefrontShell from '@/components/sorvyra/storefront-shell';
import { getStorefront } from '@/data/storefronts';

export const metadata: Metadata = {
  title: 'Zee COMFORT HUB Qatar',
  description:
    'Shop underwear, sleepwear, leggings, loungewear and essentials across Qatar.',
};

export default function ZeeComfortHubPage() {
  return <StorefrontShell storefront={getStorefront('zee-comfort-hub')} />;
}
