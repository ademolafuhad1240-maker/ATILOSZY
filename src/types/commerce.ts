export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type FulfillmentType = 'store_inventory' | 'online_inventory' | 'partner_fulfilled';

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  categorySlug: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  secondaryImages?: string[];
  badge?: string;
  featured: boolean;
  newArrival: boolean;
  inventoryStatus: InventoryStatus;
  fulfillmentType: FulfillmentType;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}
