export interface DenaldProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  badge?: string;
  href: string;
}

export interface DenaldSolution {
  name: string;
  description: string;
  image: string;
  href: string;
}

export const denaldProducts: DenaldProduct[] = [
  {
    id: 'den-solar-001',
    name: 'High-Efficiency Solar Panel',
    category: 'Solar Panels',
    price: 125000,
    image:
      'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=1000&auto=format&fit=crop&q=88',
    badge: 'Power Solution',
    href: '/ng/denald/shop',
  },
  {
    id: 'den-inverter-001',
    name: 'Hybrid Power Inverter',
    category: 'Inverters',
    price: 650000,
    image:
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1000&auto=format&fit=crop&q=88',
    badge: 'Popular',
    href: '/ng/denald/shop',
  },
  {
    id: 'den-battery-001',
    name: 'Deep-Cycle Backup Battery',
    category: 'Solar Batteries',
    price: 485000,
    image:
      'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=1000&auto=format&fit=crop&q=88',
    badge: 'Backup Power',
    href: '/ng/denald/shop',
  },
  {
    id: 'den-cctv-001',
    name: 'Four-Camera CCTV System',
    category: 'CCTV Systems',
    price: 295000,
    image:
      'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=1000&auto=format&fit=crop&q=88',
    badge: 'Security Pick',
    href: '/ng/denald/shop',
  },
  {
    id: 'den-computer-001',
    name: 'Professional Business Laptop',
    category: 'Computer Systems',
    price: 780000,
    image:
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/denald/shop',
  },
  {
    id: 'den-network-001',
    name: 'Business Networking Router',
    category: 'Networking Equipment',
    price: 95000,
    image:
      'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/denald/shop',
  },
  {
    id: 'den-light-001',
    name: 'Outdoor Solar Flood Light',
    category: 'Solar Lighting',
    price: 85000,
    image:
      'https://images.unsplash.com/photo-1497440001374-f26997328c1b?w=1000&auto=format&fit=crop&q=88',
    badge: 'Outdoor',
    href: '/ng/denald/shop',
  },
  {
    id: 'den-accessory-001',
    name: 'Solar Cable and Connector Kit',
    category: 'Solar Components',
    price: 45000,
    image:
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1000&auto=format&fit=crop&q=88',
    href: '/ng/denald/shop',
  },
];

export const denaldSolutions: DenaldSolution[] = [
  {
    name: 'Solar Power',
    description:
      'Panels, inverters, batteries, lighting and complete power solutions.',
    image:
      'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=1200&auto=format&fit=crop&q=90',
    href: '/ng/denald/shop',
  },
  {
    name: 'CCTV Security',
    description:
      'Camera systems, recorders, monitoring equipment and installation.',
    image:
      'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=1200&auto=format&fit=crop&q=90',
    href: '/ng/denald/shop',
  },
  {
    name: 'Computer Systems',
    description:
      'Computers, accessories, setup, maintenance and technical support.',
    image:
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&auto=format&fit=crop&q=90',
    href: '/ng/denald/shop',
  },
  {
    name: 'Networking',
    description:
      'Routers, connectivity equipment and practical network solutions.',
    image:
      'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1200&auto=format&fit=crop&q=90',
    href: '/ng/denald/shop',
  },
];

export const denaldServices = [
  'Solar Installation',
  'CCTV Installation',
  'Computer Setup',
  'System Inspection',
  'Maintenance and Repairs',
  'Power Assessment',
  'Site Survey',
  'Request a Quotation',
];

export function formatDenaldPrice(price: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(price);
}
