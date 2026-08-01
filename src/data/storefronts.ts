export type StorefrontTheme =
  | 'atiloszy'
  | 'zee-nigeria'
  | 'zee-qatar'
  | 'denald';

export type RegionCode = 'ng' | 'qa';

export interface Storefront {
  id: string;
  name: string;
  shortName: string;
  locationLabel: string;
  regionCode: RegionCode;
  country: string;
  currency: 'NGN' | 'QAR';
  route: string;
  description: string;
  categories: string[];
  logo: string | null;
  coverImage: string;
  theme: StorefrontTheme;
  address: string;
  hours: string;
  whatsappLabel: string;
  whatsappUrl: string;
}

export const storefronts: Storefront[] = [
  {
    id: 'atiloszy',
    name: 'ATILOSZY Varieties Store',
    shortName: 'ATILOSZY',
    locationLabel: 'Osogbo, Osun State',
    regionCode: 'ng',
    country: 'Nigeria',
    currency: 'NGN',
    route: '/ng/atiloszy',
    description:
      'Shoes, household products, useful gadgets, gifts and everyday essentials selected for modern living.',
    categories: [
      'Shoes',
      'Home & Household',
      'Kitchen Essentials',
      'Fashion Accessories',
      'Small Gadgets',
      'Everyday Essentials',
    ],
    logo: '/brand/atiloszy-logo-original.png',
    coverImage:
      'https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=1400&auto=format&fit=crop&q=88',
    theme: 'atiloszy',
    address:
      'Shop 1, Akilog Complex, opposite Al-Mitiqeey Mosque, Ire Akari, Oke Ijetu, Ilesa Garage, Osogbo.',
    hours: 'Open daily, 10:00 AM–6:00 PM',
    whatsappLabel: '07074417879',
    whatsappUrl: 'https://wa.me/2347074417879',
  },
  {
    id: 'zee-beauty-fashion',
    name: 'ZEE Beauty & Fashion World',
    shortName: 'ZEE Beauty & Fashion',
    locationLabel: 'Osogbo, Osun State',
    regionCode: 'ng',
    country: 'Nigeria',
    currency: 'NGN',
    route: '/ng/zee-beauty-fashion',
    description:
      'Beauty, fashion, personal care, household items and daily essentials in one welcoming store.',
    categories: [
      'Skincare',
      'Haircare',
      'Makeup',
      'Fragrances',
      'Fashion',
      'Personal Care',
      'Household Items',
    ],
    logo: '/brand/zee-beauty-fashion-logo.webp',
    coverImage:
      'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1400&auto=format&fit=crop&q=88',
    theme: 'zee-nigeria',
    address: 'Okinni, Olaoluwa Estate, Osogbo, Osun State.',
    hours: 'Open daily, 10:00 AM–6:00 PM',
    whatsappLabel: '09159894953',
    whatsappUrl: 'https://wa.me/2349159894953',
  },
  {
    id: 'denald',
    name: 'DENALD Solar | CCTV | Computer',
    shortName: 'DENALD',
    locationLabel: 'Ibadan, Oyo State',
    regionCode: 'ng',
    country: 'Nigeria',
    currency: 'NGN',
    route: '/ng/denald',
    description:
      'Solar products, CCTV systems, computer solutions and professional installation services.',
    categories: [
      'Solar Panels',
      'Inverters',
      'Batteries',
      'Solar Components',
      'CCTV',
      'Computers',
      'Installation Services',
    ],
    logo: '/brand/denald-logo.png',
    coverImage:
      'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=1400&auto=format&fit=crop&q=88',
    theme: 'denald',
    address: 'Ibadan, Oyo State. Full physical address to be confirmed.',
    hours: 'Service appointments and WhatsApp enquiries available',
    whatsappLabel: '08186710526',
    whatsappUrl: 'https://wa.me/2348186710526',
  },
  {
    id: 'zee-comfort-hub',
    name: 'Zee COMFORT HUB',
    shortName: 'Zee COMFORT HUB',
    locationLabel: 'Fareej Abdul Aziz, Doha',
    regionCode: 'qa',
    country: 'Qatar',
    currency: 'QAR',
    route: '/qa/zee-comfort-hub',
    description:
      'Comfort-focused underwear, sleepwear, leggings, loungewear and everyday essentials for women and men.',
    categories: [
      'Bras & Bralettes',
      'Women’s Underwear',
      'Leggings',
      'Sleepwear',
      'Men’s Boxers',
      'T-Shirts',
      'Loungewear',
    ],
    logo: '/brand/zee-comfort-hub-logo-2026.webp',
    coverImage:
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1400&auto=format&fit=crop&q=88',
    theme: 'zee-qatar',
    address: 'Fareej Abdul Aziz, Doha, Qatar.',
    hours: 'Open daily, 10:00 AM–6:00 PM',
    whatsappLabel: '+974 3097 5465',
    whatsappUrl: 'https://wa.me/97430975465',
  },
];

export function getStorefront(id: string): Storefront {
  const storefront = storefronts.find((item) => item.id === id);

  if (!storefront) {
    throw new Error(`Unknown storefront: ${id}`);
  }

  return storefront;
}

export function getStorefrontsByRegion(regionCode: RegionCode): Storefront[] {
  return storefronts.filter((storefront) => storefront.regionCode === regionCode);
}
