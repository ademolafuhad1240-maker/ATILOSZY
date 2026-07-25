export interface ZeeNigeriaProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  badge?: string;
  href: string;
}

export interface ZeeNigeriaCategory {
  name: string;
  description: string;
  image: string;
  href: string;
}

export const zeeNigeriaProducts: ZeeNigeriaProduct[] = [
  {
    id: 'zbf-skincare-001',
    name: 'Daily Hydration Collection',
    category: 'Skincare',
    price: 24500,
    image:
      'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1000&auto=format&fit=crop&q=88',
    badge: 'Routine Pick',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    id: 'zbf-makeup-001',
    name: 'Everyday Makeup Edit',
    category: 'Makeup',
    price: 28500,
    image:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1000&auto=format&fit=crop&q=88',
    badge: 'Trending',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    id: 'zbf-fashion-001',
    name: 'Structured Everyday Handbag',
    category: 'Fashion Accessories',
    price: 48000,
    image:
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1000&auto=format&fit=crop&q=88',
    badge: 'New',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    id: 'zbf-fragrance-001',
    name: 'Signature Fragrance Selection',
    category: 'Fragrance',
    price: 36500,
    image:
      'https://images.unsplash.com/photo-1541643600914-78b084683601?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    id: 'zbf-haircare-001',
    name: 'Nourishing Haircare Set',
    category: 'Haircare',
    price: 22500,
    image:
      'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=1000&auto=format&fit=crop&q=88',
    badge: 'Popular',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    id: 'zbf-fashion-002',
    name: 'Soft Lounge Co-Ord',
    category: 'Women’s Fashion',
    price: 42000,
    image:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    id: 'zbf-personal-001',
    name: 'Personal Care Essentials',
    category: 'Personal Care',
    price: 19500,
    image:
      'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    id: 'zbf-accessory-001',
    name: 'Polished Everyday Watch',
    category: 'Accessories',
    price: 42000,
    image:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&auto=format&fit=crop&q=88',
    badge: 'Limited',
    href: '/ng/zee-beauty-fashion/shop',
  },
];

export const zeeNigeriaCategories: ZeeNigeriaCategory[] = [
  {
    name: 'Skincare',
    description:
      'Cleansers, moisturisers and daily-care essentials for simple routines.',
    image:
      'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    name: 'Haircare',
    description:
      'Practical products for cleansing, conditioning and everyday hair care.',
    image:
      'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    name: 'Makeup',
    description:
      'Everyday colour, beauty tools and polished finishing touches.',
    image:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    name: 'Fragrances',
    description:
      'Fresh, warm and memorable scents for different moods and moments.',
    image:
      'https://images.unsplash.com/photo-1541643600914-78b084683601?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    name: 'Fashion',
    description:
      'Clothing and accessories selected for comfort and everyday expression.',
    image:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion/shop',
  },
  {
    name: 'Personal Care',
    description:
      'Daily essentials for care, freshness and convenient routines.',
    image:
      'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/zee-beauty-fashion/shop',
  },
];

export function formatZeeNigeriaPrice(price: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(price);
}
