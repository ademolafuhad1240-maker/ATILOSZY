import type {
  CartStatus,
} from "../../generated/prisma/client";

export interface CartIdentityInput {
  storefrontCode: string;
  userId: string;
}

export interface AddCartItemInput
  extends CartIdentityInput {
  productVariantId: string;
  quantity: number;
}

export interface UpdateCartItemQuantityInput
  extends CartIdentityInput {
  cartItemId: string;
  quantity: number;
}

export interface RemoveCartItemInput
  extends CartIdentityInput {
  cartItemId: string;
}

export interface CartItemView {
  id: string;
  storefrontProductId: string;
  productVariantId: string;
  storefrontPriceId: string;
  quantity: number;
  unitPrice: string;
  compareAtUnitPrice: string | null;
  lineTotal: string;
  productName: string;
  variantTitle: string;
  sku: string;
}

export interface CartView {
  id: string;
  storefrontId: string;
  storefrontCode: string;
  userId: string;
  currencyCode: string;
  status: CartStatus;
  expiresAt: string | null;
  itemCount: number;
  uniqueItemCount: number;
  subtotal: string;
  compareAtSubtotal: string | null;
  savings: string;
  items: CartItemView[];
  createdAt: string;
  updatedAt: string;
}

export type CartValidationIssueCode =
  | "PRODUCT_UNAVAILABLE"
  | "PRICE_UNAVAILABLE"
  | "QUANTITY_LIMIT"
  | "INSUFFICIENT_STOCK";

export interface CartValidationIssue {
  cartItemId: string;
  productVariantId: string;
  code: CartValidationIssueCode;
  message: string;
  availableQuantity?: number | null;
  maximumQuantity?: number | null;
}

export interface CartValidationResult {
  valid: boolean;
  cart: CartView;
  issues: CartValidationIssue[];
}

export type PublicCartView = Omit<
  CartView,
  "storefrontId" | "userId"
>;

export interface PublicCartValidationResult {
  valid: boolean;
  cart: PublicCartView;
  issues: CartValidationIssue[];
}
