import type {
  CartValidationResult,
  CartView,
  PublicCartValidationResult,
  PublicCartView,
} from "./types";

export function toPublicCartView(
  cart: CartView,
): PublicCartView {
  return {
    id: cart.id,
    storefrontCode:
      cart.storefrontCode,
    currencyCode:
      cart.currencyCode,
    status: cart.status,
    expiresAt: cart.expiresAt,
    itemCount: cart.itemCount,
    uniqueItemCount:
      cart.uniqueItemCount,
    subtotal: cart.subtotal,
    compareAtSubtotal:
      cart.compareAtSubtotal,
    savings: cart.savings,
    items: cart.items,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
}

export function toPublicCartValidation(
  result: CartValidationResult,
): PublicCartValidationResult {
  return {
    valid: result.valid,
    cart:
      toPublicCartView(
        result.cart,
      ),
    issues: result.issues,
  };
}
