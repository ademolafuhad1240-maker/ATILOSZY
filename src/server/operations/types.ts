import type {
  OrderAddressType,
  OrderFulfilmentAction,
  OrderFulfilmentMethod,
  OrderFulfilmentStatus,
  OrderPaymentStatus,
  OrderStatus,
  StorefrontStaffRole,
} from "@/generated/prisma/client";

export type StaffOrderQueue =
  | "ACTIONABLE"
  | "COMPLETED"
  | "ALL";

export interface StaffContextView {
  role:
    StorefrontStaffRole;
  storefrontCode: string;
}

export interface StaffOrderItemView {
  id: string;
  productName: string;
  variantTitle: string;
  sku: string;
  quantity: number;
  lineTotal: string;
}

export interface StaffOrderAddressView {
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

export interface StaffOrderEventView {
  id: string;
  action:
    OrderFulfilmentAction;
  actorRole:
    StorefrontStaffRole;
  fromOrderStatus:
    OrderStatus;
  toOrderStatus:
    OrderStatus;
  fromFulfilmentStatus:
    OrderFulfilmentStatus;
  toFulfilmentStatus:
    OrderFulfilmentStatus;
  note: string | null;
  createdAt: string;
}

export interface StaffOrderView {
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
  productTotal: string;
  deliveryFeeTotal: string;
  grandTotal: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNote: string | null;
  placedAt: string;
  paidAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  availableActions:
    OrderFulfilmentAction[];
  holdReason:
    | "DELIVERY_PAYMENT_REQUIRED"
    | "VIEW_ONLY"
    | null;
  items:
    StaffOrderItemView[];
  addresses:
    StaffOrderAddressView[];
  events:
    StaffOrderEventView[];
}

export interface ListStaffOrdersInput {
  storefrontCode: string;
  userId: string;
  queue?: StaffOrderQueue;
  limit?: number;
}

export interface ListStaffOrdersResult {
  staff: StaffContextView;
  queue: StaffOrderQueue;
  orders: StaffOrderView[];
}

export interface TransitionStaffOrderInput {
  storefrontCode: string;
  userId: string;
  orderNumber: string;
  action:
    OrderFulfilmentAction;
  note?: string | null;
}

export interface TransitionStaffOrderResult {
  staff: StaffContextView;
  order: StaffOrderView;
}
