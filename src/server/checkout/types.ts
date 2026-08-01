import type {
  OrderAddressType,
  OrderFulfilmentMethod,
  OrderFulfilmentStatus,
  OrderPaymentMethod,
  OrderPaymentPurpose,
  OrderPaymentStatus,
  OrderStatus,
} from "@/generated/prisma/client";

export interface CheckoutIdentityInput {
  storefrontCode: string;
  userId: string;
}

export interface CheckoutAddressInput {
  recipientName: string;
  phone: string;
  email?: string | null;
  countryCode: string;
  state?: string | null;
  city: string;
  postalCode?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  deliveryNotes?: string | null;
}

export interface NormalizedCheckoutAddress {
  recipientName: string;
  phone: string;
  email: string | null;
  countryCode: string;
  state: string | null;
  city: string;
  postalCode: string | null;
  addressLine1: string;
  addressLine2: string | null;
  deliveryNotes: string | null;
}

export interface CreateCheckoutOrderInput
  extends CheckoutIdentityInput {
  cartId: string;
  fulfilmentMethod:
    OrderFulfilmentMethod;
  deliveryAddress?:
    | CheckoutAddressInput
    | null;
  billingAddress?:
    | CheckoutAddressInput
    | null;
  customerNote?: string | null;
}

export interface GetCheckoutOrderInput
  extends CheckoutIdentityInput {
  orderNumber: string;
}

export interface CancelCheckoutOrderInput
  extends GetCheckoutOrderInput {
  reason?: string | null;
}

export interface CheckoutOrderItemView {
  id: string;
  productName: string;
  variantTitle: string;
  sku: string;
  sellingUnitLabel: string;
  unitsPerSellingUnit: number;
  quantityDiscountMinimum: number | null;
  quantity: number;
  unitPrice: string;
  compareAtUnitPrice:
    | string
    | null;
  lineSubtotal: string;
  discountTotal: string;
  lineTotal: string;
}

export interface CheckoutOrderAddressView {
  id: string;
  type: OrderAddressType;
  recipientName: string;
  phone: string;
  email: string | null;
  countryCode: string;
  state: string | null;
  city: string;
  postalCode: string | null;
  addressLine1: string;
  addressLine2: string | null;
  deliveryNotes: string | null;
}

export interface CheckoutOrderPaymentView {
  id: string;
  purpose: OrderPaymentPurpose;
  method:
    | OrderPaymentMethod
    | null;
  status: OrderPaymentStatus;
  amount: string;
  initiatedAt: string;
  paidAt: string | null;
}

export interface CheckoutOrderView {
  id: string;
  orderNumber: string;
  storefrontCode: string;
  currencyCode: string;
  status: OrderStatus;
  fulfilmentMethod:
    OrderFulfilmentMethod;
  fulfilmentStatus:
    OrderFulfilmentStatus;
  productPaymentStatus:
    OrderPaymentStatus;
  deliveryPaymentStatus:
    OrderPaymentStatus;
  productSubtotal: string;
  discountTotal: string;
  productTotal: string;
  deliveryFeeTotal: string;
  grandTotal: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNote: string | null;
  cancellationReason:
    | string
    | null;
  placedAt: string;
  paidAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  items: CheckoutOrderItemView[];
  addresses:
    CheckoutOrderAddressView[];
  payments:
    CheckoutOrderPaymentView[];
}
