import type {
  CategoryStatus,
  PriceType,
  ProductStatus,
  ProductVariantStatus,
  StockMovementType,
  StorefrontProductStatus,
} from "@/generated/prisma/client";

export interface CatalogVariantOptionInput {
  name: string;
  value: string;
  position?: number;
}

export interface CatalogPriceInput {
  amount: string;
  compareAtAmount?: string | null;
  costAmount?: string | null;
  type?: PriceType;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface CatalogImageInput {
  url: string;
  altText?: string | null;
}

export interface CreateCatalogProductInput {
  storefrontKey: string;
  categorySlug: string;
  listingSlug: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  brand?: string | null;
  productStatus?: ProductStatus;
  listingStatus?: StorefrontProductStatus;
  isFeatured?: boolean;
  isDemo?: boolean;
  sortOrder?: number;
  maxPerOrder?: number | null;
  publishedAt?: Date | null;
  availableFrom?: Date | null;
  availableUntil?: Date | null;
  image?: CatalogImageInput | null;
  variant: {
    sku: string;
    title: string;
    barcode?: string | null;
    options?: readonly CatalogVariantOptionInput[];
    price: CatalogPriceInput;
    initialStock: number;
    quantityReserved?: number;
    reorderLevel?: number;
    isTracked?: boolean;
    allowBackorder?: boolean;
    weightGrams?: number | null;
    openingStockReason?: string | null;
    openingStockReferenceType?: string | null;
    openingStockReferenceId?: string | null;
  };
}

export interface CreatedCatalogProduct {
  productId: string;
  storefrontProductId: string;
  variantId: string;
  listingSlug: string;
  sku: string;
  storefrontCode: string;
  currencyCode: string;
}

export interface PublicCatalogPrice {
  type: PriceType;
  amount: string;
  compareAtAmount: string | null;
  currencyCode: string;
}

export interface PublicCatalogOption {
  name: string;
  value: string;
}

export interface PublicCatalogVariant {
  id: string;
  sku: string;
  title: string;
  options: PublicCatalogOption[];
  price: PublicCatalogPrice;
  imageUrl: string | null;
  availableQuantity: number | null;
  isInStock: boolean;
  allowBackorder: boolean;
}

export interface PublicCatalogProduct {
  id: string;
  productId: string;
  storefrontCode: string;
  storefrontKey: string;
  storefrontName: string;
  currencyCode: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  category: {
    slug: string;
    name: string;
  } | null;
  primaryImageUrl: string | null;
  isFeatured: boolean;
  variants: PublicCatalogVariant[];
}

export interface AdjustVariantStockInput {
  storefrontKey: string;
  sku: string;
  quantityDelta: number;
  type: StockMovementType;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface AdjustedInventory {
  inventoryId: string;
  sku: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
}

export interface ManagerCatalogCategory {
  id: string;
  slug: string;
  name: string;
  status: CategoryStatus;
}

export interface ManagerCatalogStockMovement {
  id: string;
  type: StockMovementType;
  quantityDelta: number;
  quantityOnHandAfter: number;
  quantityReservedAfter: number;
  reason: string | null;
  createdAt: string;
}

export interface ManagerCatalogProduct {
  id: string;
  productId: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  categorySlug: string;
  listingStatus: StorefrontProductStatus;
  productStatus: ProductStatus;
  isFeatured: boolean;
  maxPerOrder: number | null;
  publishedAt: string | null;
  updatedAt: string;
  image: {
    url: string;
    altText: string | null;
  } | null;
  variant: {
    id: string;
    sku: string;
    title: string;
    status: ProductVariantStatus;
    price: {
      amount: string;
      compareAtAmount: string | null;
      costAmount: string | null;
      currencyCode: string;
    };
    inventory: {
      quantityOnHand: number;
      quantityReserved: number;
      availableQuantity: number;
      reorderLevel: number;
      isTracked: boolean;
      allowBackorder: boolean;
      movements: ManagerCatalogStockMovement[];
    };
  };
}

export interface ManagerCatalogView {
  manager: {
    email: string;
  };
  storefront: {
    code: string;
    key: string;
    name: string;
    currencyCode: string;
  };
  categories: ManagerCatalogCategory[];
  products: ManagerCatalogProduct[];
}

export interface ManagedCatalogProductFields {
  categorySlug: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  brand?: string | null;
  listingStatus: StorefrontProductStatus;
  isFeatured: boolean;
  maxPerOrder?: number | null;
  imageUrl?: string | null;
  imageAltText?: string | null;
  variantTitle: string;
  priceAmount: string;
  compareAtAmount?: string | null;
  costAmount?: string | null;
  reorderLevel: number;
  isTracked: boolean;
  allowBackorder: boolean;
}

export interface CreateManagedCatalogProductInput
  extends ManagedCatalogProductFields {
  storefrontCode: string;
  userId: string;
  listingSlug: string;
  sku: string;
  initialStock: number;
}

export interface UpdateManagedCatalogProductInput
  extends ManagedCatalogProductFields {
  storefrontCode: string;
  userId: string;
  storefrontProductId: string;
}

export interface AdjustManagedCatalogStockInput {
  storefrontCode: string;
  userId: string;
  storefrontProductId: string;
  quantityDelta: number;
  type: StockMovementType;
  reason: string;
}
