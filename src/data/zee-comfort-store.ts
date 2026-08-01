export interface ComfortProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  badge?: string;
  href: string;
}

export interface ComfortCategory {
  name: string;
  description: string;
  image: string;
  href: string;
}

const shopRoute = '/qa/zee-comfort-hub/shop#products';

export const comfortProducts: ComfortProduct[] = [
  {
    id: 'zch-lounge-001',
    name: 'Soft Everyday Underwear Set',
    category: 'Women’s Underwear',
    price: 179,
    image: '/brand/zee-comfort-hub-bras-underwear.webp',
    badge: 'Comfort Pick',
    href: shopRoute,
  },
  {
    id: 'zch-legging-001',
    name: 'High-Rise Everyday Leggings',
    category: 'Leggings',
    price: 89,
    image: '/brand/zee-comfort-hub-sleepwear-leggings.webp',
    badge: 'Popular',
    href: shopRoute,
  },
  {
    id: 'zch-sleep-001',
    name: 'Relaxed Sleepwear Set',
    category: 'Sleepwear',
    price: 149,
    image: '/brand/zee-comfort-hub-sleepwear-leggings.webp',
    badge: 'New',
    href: shopRoute,
  },
  {
    id: 'zch-bralette-001',
    name: 'Everyday Comfort Bralette',
    category: 'Bras & Bralettes',
    price: 79,
    image: '/brand/zee-comfort-hub-bras-underwear.webp',
    href: shopRoute,
  },
  {
    id: 'zch-vintage-001',
    name: 'Vintage-Inspired Blouse',
    category: 'Vintage Clothing',
    price: 165,
    image:
      'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1000&auto=format&fit=crop&q=88',
    badge: 'Limited',
    href: shopRoute,
  },
  {
    id: 'zch-shirt-001',
    name: 'Relaxed Round-Neck Shirt',
    category: 'T-Shirts & Round Necks',
    price: 95,
    image: '/brand/zee-comfort-hub-mens-essentials.webp',
    href: shopRoute,
  },
  {
    id: 'zch-essential-001',
    name: 'Women’s Everyday Essentials Set',
    category: 'Women’s Essentials',
    price: 129,
    image: '/brand/zee-comfort-hub-essentials-hero.webp',
    href: shopRoute,
  },
  {
    id: 'zch-men-001',
    name: 'Men’s Comfort Essentials Pack',
    category: 'Men’s Essentials',
    price: 119,
    image: '/brand/zee-comfort-hub-mens-essentials.webp',
    href: shopRoute,
  },
];

export const comfortCategories: ComfortCategory[] = [
  {
    name: 'Women’s Underwear',
    description:
      'Soft everyday underwear selected for practical comfort and easy movement.',
    image: '/brand/zee-comfort-hub-bras-underwear.webp',
    href: shopRoute,
  },
  {
    name: 'Bras & Bralettes',
    description:
      'Supportive everyday styles designed around comfort and ease.',
    image: '/brand/zee-comfort-hub-bras-underwear.webp',
    href: shopRoute,
  },
  {
    name: 'Sleepwear',
    description:
      'Soft sleep and relaxation pieces for calmer evenings.',
    image: '/brand/zee-comfort-hub-sleepwear-leggings.webp',
    href: shopRoute,
  },
  {
    name: 'Leggings',
    description:
      'Flexible everyday leggings for comfort, errands and relaxed styling.',
    image: '/brand/zee-comfort-hub-sleepwear-leggings.webp',
    href: shopRoute,
  },
  {
    name: 'Men’s Boxers',
    description:
      'Comfortable boxer briefs and everyday underwear for men.',
    image: '/brand/zee-comfort-hub-mens-essentials.webp',
    href: shopRoute,
  },
  {
    name: 'Vintage Clothing',
    description:
      'Distinctive vintage-inspired pieces with individual character.',
    image:
      'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1100&auto=format&fit=crop&q=88',
    href: shopRoute,
  },
  {
    name: 'Round-Neck Essentials',
    description:
      'Plain round-neck shirts and easy layers for women and men.',
    image: '/brand/zee-comfort-hub-mens-essentials.webp',
    href: shopRoute,
  },
  {
    name: 'Women’s Essentials',
    description:
      'A practical mix of comfortable pieces for everyday routines.',
    image: '/brand/zee-comfort-hub-essentials-hero.webp',
    href: shopRoute,
  },
  {
    name: 'Men’s Essentials',
    description:
      'Boxers, singlets and round-neck basics selected for everyday comfort.',
    image: '/brand/zee-comfort-hub-mens-essentials.webp',
    href: shopRoute,
  },
];

export function formatComfortPrice(price: number): string {
  return new Intl.NumberFormat('en-QA', {
    style: 'currency',
    currency: 'QAR',
    maximumFractionDigits: 0,
  }).format(price);
}
