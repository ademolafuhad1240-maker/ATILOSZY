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
    name: 'Soft Everyday Lounge Set',
    category: 'Loungewear',
    price: 179,
    image:
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1000&auto=format&fit=crop&q=88',
    badge: 'Comfort Pick',
    href: shopRoute,
  },
  {
    id: 'zch-legging-001',
    name: 'High-Rise Everyday Leggings',
    category: 'Leggings',
    price: 89,
    image:
      'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=1000&auto=format&fit=crop&q=88',
    badge: 'Popular',
    href: shopRoute,
  },
  {
    id: 'zch-sleep-001',
    name: 'Relaxed Sleepwear Set',
    category: 'Sleepwear',
    price: 149,
    image:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1000&auto=format&fit=crop&q=88',
    badge: 'New',
    href: shopRoute,
  },
  {
    id: 'zch-bralette-001',
    name: 'Everyday Comfort Bralette',
    category: 'Bras & Bralettes',
    price: 79,
    image:
      'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=1000&auto=format&fit=crop&q=88',
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
    image:
      'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1000&auto=format&fit=crop&q=88',
    href: shopRoute,
  },
  {
    id: 'zch-essential-001',
    name: 'Women’s Everyday Essentials Set',
    category: 'Women’s Essentials',
    price: 129,
    image:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1000&auto=format&fit=crop&q=88',
    href: shopRoute,
  },
  {
    id: 'zch-men-001',
    name: 'Men’s Comfort Essentials Pack',
    category: 'Men’s Essentials',
    price: 119,
    image:
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=1000&auto=format&fit=crop&q=88',
    href: shopRoute,
  },
];

export const comfortCategories: ComfortCategory[] = [
  {
    name: 'Women’s Essentials',
    description:
      'Comfort-focused everyday pieces selected for practical daily wear.',
    image:
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1100&auto=format&fit=crop&q=88',
    href: shopRoute,
  },
  {
    name: 'Bras & Bralettes',
    description:
      'Supportive everyday styles designed around comfort and ease.',
    image:
      'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=1100&auto=format&fit=crop&q=88',
    href: shopRoute,
  },
  {
    name: 'Sleepwear',
    description:
      'Soft sleep and relaxation pieces for calmer evenings.',
    image:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1100&auto=format&fit=crop&q=88',
    href: shopRoute,
  },
  {
    name: 'Leggings',
    description:
      'Flexible everyday leggings for comfort, errands and relaxed styling.',
    image:
      'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=1100&auto=format&fit=crop&q=88',
    href: shopRoute,
  },
  {
    name: 'Loungewear',
    description:
      'Relaxed clothing designed for easy days and comfortable moments.',
    image:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1100&auto=format&fit=crop&q=88',
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
];

export function formatComfortPrice(price: number): string {
  return new Intl.NumberFormat('en-QA', {
    style: 'currency',
    currency: 'QAR',
    maximumFractionDigits: 0,
  }).format(price);
}
