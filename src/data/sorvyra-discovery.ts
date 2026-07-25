export type DiscoveryCurrency = 'NGN' | 'QAR';

export interface DiscoveryProduct {
  id: string;
  name: string;
  store: string;
  country: 'Nigeria' | 'Qatar';
  currency: DiscoveryCurrency;
  price: number;
  image: string;
  href: string;
  badge?: string;
}

export const discoveryProducts: DiscoveryProduct[] = [
  {
    id: 'discovery-001',
    name: 'Modern Everyday Sneakers',
    store: 'ATILOSZY',
    country: 'Nigeria',
    currency: 'NGN',
    price: 38500,
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy',
    badge: 'Trending',
  },
  {
    id: 'discovery-002',
    name: 'Daily Skincare Collection',
    store: 'ZEE Beauty & Fashion',
    country: 'Nigeria',
    currency: 'NGN',
    price: 24500,
    image:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion',
    badge: 'New',
  },
  {
    id: 'discovery-003',
    name: 'Premium Structured Handbag',
    store: 'ZEE Beauty & Fashion',
    country: 'Nigeria',
    currency: 'NGN',
    price: 48000,
    image:
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion',
  },
  {
    id: 'discovery-004',
    name: 'Compact Wireless Speaker',
    store: 'ATILOSZY',
    country: 'Nigeria',
    currency: 'NGN',
    price: 36500,
    image:
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy',
    badge: 'Popular',
  },
  {
    id: 'discovery-005',
    name: 'Home Solar Power Kit',
    store: 'DENALD',
    country: 'Nigeria',
    currency: 'NGN',
    price: 285000,
    image:
      'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/denald',
    badge: 'Power Solution',
  },
  {
    id: 'discovery-006',
    name: 'Soft Everyday Loungewear',
    store: 'Zee COMFORT HUB',
    country: 'Qatar',
    currency: 'QAR',
    price: 149,
    image:
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1000&auto=format&fit=crop&q=88',
    href: '/qa/zee-comfort-hub',
    badge: 'Comfort Pick',
  },
  {
    id: 'discovery-007',
    name: 'Insulated Travel Tumbler',
    store: 'ATILOSZY',
    country: 'Nigeria',
    currency: 'NGN',
    price: 18500,
    image:
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy',
  },
  {
    id: 'discovery-008',
    name: 'Essential Beauty Organiser',
    store: 'ZEE Beauty & Fashion',
    country: 'Nigeria',
    currency: 'NGN',
    price: 22500,
    image:
      'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion',
  },
];

export function formatDiscoveryPrice(
  price: number,
  currency: DiscoveryCurrency,
): string {
  return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-QA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}
