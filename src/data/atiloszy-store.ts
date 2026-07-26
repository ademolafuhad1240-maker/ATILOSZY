export interface AtiloszyProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  badge?: string;
  href: string;
}

export interface AtiloszyCategory {
  name: string;
  description: string;
  image: string;
  href: string;
}

export const atiloszyProducts: AtiloszyProduct[] = [
  {
    id: 'ati-footwear-001',
    name: 'Urban Everyday Trainers',
    category: 'Footwear',
    price: 38500,
    image:
      'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=1000&auto=format&fit=crop&q=88',
    badge: 'Trending',
    href: '/ng/atiloszy/shop#products',
  },
  {
    id: 'ati-footwear-002',
    name: 'Classic Neutral Loafers',
    category: 'Footwear',
    price: 32000,
    image:
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=1000&auto=format&fit=crop&q=88',
    badge: 'New',
    href: '/ng/atiloszy/shop#products',
  },
  {
    id: 'ati-home-001',
    name: 'Sculpted Aroma Diffuser',
    category: 'Home & Living',
    price: 28500,
    image:
      'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1000&auto=format&fit=crop&q=88',
    badge: 'Featured',
    href: '/ng/atiloszy/shop#products',
  },
  {
    id: 'ati-everyday-001',
    name: 'Insulated Travel Tumbler',
    category: 'Everyday Essentials',
    price: 18500,
    image:
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy/shop#products',
  },
  {
    id: 'ati-gadget-001',
    name: 'Compact Wireless Speaker',
    category: 'Gadgets',
    price: 36500,
    image:
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=1000&auto=format&fit=crop&q=88',
    badge: 'Popular',
    href: '/ng/atiloszy/shop#products',
  },
  {
    id: 'ati-gadget-002',
    name: 'Foldable Charging Stand',
    category: 'Gadgets',
    price: 17500,
    image:
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy/shop#products',
  },
  {
    id: 'ati-fashion-001',
    name: 'Structured Mini Tote',
    category: 'Fashion Accessories',
    price: 48500,
    image:
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1000&auto=format&fit=crop&q=88',
    badge: 'Limited',
    href: '/ng/atiloszy/shop#products',
  },
  {
    id: 'ati-home-002',
    name: 'Modular Storage Caddy',
    category: 'Home Essentials',
    price: 21500,
    image:
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy/shop#products',
  },
];

export const atiloszyCategories: AtiloszyCategory[] = [
  {
    name: 'Footwear',
    description: 'Shoes selected for comfort, daily movement and personal style.',
    image:
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy/shop#products',
  },
  {
    name: 'Home & Living',
    description: 'Useful products that bring order, comfort and character into your space.',
    image:
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy/shop#products',
  },
  {
    name: 'Kitchen Essentials',
    description: 'Practical kitchen products for easier everyday routines.',
    image:
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy/shop#products',
  },
  {
    name: 'Gadgets',
    description: 'Compact technology and accessories for work, travel and relaxation.',
    image:
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy/shop#products',
  },
  {
    name: 'Fashion Accessories',
    description: 'Bags, watches and accessories that complete the everyday look.',
    image:
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy/shop#products',
  },
  {
    name: 'Kids & Gifts',
    description: 'Thoughtful gifts and creative products for children and special moments.',
    image:
      'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=1100&auto=format&fit=crop&q=88',
    href: '/ng/atiloszy/shop#products',
  },
];

export function formatAtiloszyPrice(price: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(price);
}
