export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type FulfillmentType = 'store_inventory' | 'online_inventory' | 'partner_fulfilled';

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice?: number | null;
  image: string;
  secondaryImages?: string[];
  categorySlug: string;
  badge?: string | null;
  featured: boolean;
  isNew: boolean;
  inventoryStatus: InventoryStatus;
  fulfillmentType: FulfillmentType;
}
