#!/usr/bin/env bash

set -Eeuo pipefail

DETAIL_LOG="/tmp/sorvyra-phase-2f-c-details.log"
: >"$DETAIL_LOG"

run_quiet() {
  local label="$1"
  shift

  echo
  echo "=== $label ==="

  if "$@" >>"$DETAIL_LOG" 2>&1; then
    echo "PASS: $label"
  else
    echo "FAIL: $label"
    echo
    echo "=== FAILURE LOG TAIL ==="
    tail -n 180 "$DETAIL_LOG"
    exit 1
  fi
}

echo "=== VERIFY CLEAN CHECKPOINT ==="

EXPECTED_BRANCH="feat/commerce-foundation"
CURRENT_BRANCH="$(git branch --show-current)"

if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
  echo "Expected branch: $EXPECTED_BRANCH"
  echo "Current branch: $CURRENT_BRANCH"
  exit 1
fi

UNEXPECTED_CHANGES="$(
  git status --porcelain |
  grep -v '^?? scripts/setup-cart-api-pages.sh$' ||
  true
)"

if [ -n "$UNEXPECTED_CHANGES" ]; then
  echo "Unexpected repository changes exist:"
  printf '%s\n' "$UNEXPECTED_CHANGES"
  exit 1
fi

echo "Branch: $CURRENT_BRANCH"
echo "Starting commit: $(git rev-parse --short HEAD)"
echo "PASS: Working tree is clean."

echo
echo "=== VERIFY REQUIRED FOUNDATIONS ==="

python - <<'PY'
from pathlib import Path

required_files = [
    Path("src/server/cart/service.ts"),
    Path("src/server/cart/types.ts"),
    Path("src/server/cart/index.ts"),
    Path("src/server/auth/http.ts"),
    Path("src/server/auth/page-session.ts"),
    Path("src/lib/storefront-auth.ts"),
]

for path in required_files:
    if not path.exists():
        raise RuntimeError(
            f"Required foundation file is missing: {path}"
        )

cart_index = Path(
    "src/server/cart/index.ts"
).read_text(
    encoding="utf-8",
)

for value in [
    "getOrCreateActiveCart",
    "addCartItem",
    "updateCartItemQuantity",
    "removeCartItem",
    "clearActiveCart",
    "refreshActiveCart",
    "validateActiveCart",
]:
    if value not in cart_index:
        raise RuntimeError(
            f"Required cart export is missing: {value}"
        )

print(
    "PASS: Authentication and secure cart foundations are available."
)
PY

echo
echo "=== EXTEND CART PRESENTATION TYPES ==="

cat >> src/server/cart/types.ts <<'TS'

export type PublicCartView = Omit<
  CartView,
  "storefrontId" | "userId"
>;

export interface PublicCartValidationResult {
  valid: boolean;
  cart: PublicCartView;
  issues: CartValidationIssue[];
}
TS

python - <<'PY'
from pathlib import Path

path = Path(
    "src/server/cart/index.ts"
)

content = path.read_text(
    encoding="utf-8",
)

old = '''  CartValidationResult,
  CartView,
  RemoveCartItemInput,'''

new = '''  CartValidationResult,
  CartView,
  PublicCartValidationResult,
  PublicCartView,
  RemoveCartItemInput,'''

if old not in content:
    raise RuntimeError(
        "Could not locate the cart type export block."
    )

content = content.replace(
    old,
    new,
    1,
)

path.write_text(
    content,
    encoding="utf-8",
)

print(
    "PASS: Public cart presentation types were exported."
)
PY

echo
echo "=== CREATE CART PRESENTATION MAPPER ==="

cat > src/server/cart/presentation.ts <<'TS'
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
TS

echo
echo "=== CREATE CART HTTP UTILITIES ==="

cat > src/server/cart/http.ts <<'TS'
import "server-only";

import type {
  NextRequest,
} from "next/server";

import {
  validateSession,
} from "../auth";
import {
  authApiErrorResponse,
  authJsonResponse,
  getAuthTokenSecret,
  readSessionCookie,
} from "../auth/http";

import {
  CartServiceError,
} from "./errors";

export function requireStorefrontCode(
  value:
    | string
    | null
    | undefined,
): string {
  const normalized =
    value?.trim().toUpperCase() ??
    "";

  if (
    normalized.length < 2 ||
    normalized.length > 12 ||
    !/^[A-Z0-9_-]+$/.test(
      normalized,
    )
  ) {
    throw new CartServiceError(
      "VALIDATION",
      "A valid storefront code is required.",
    );
  }

  return normalized;
}

export function requiredIntegerField(
  body: Record<string, unknown>,
  field: string,
): number {
  const value = body[field];

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    throw new CartServiceError(
      "VALIDATION",
      `${field} must be a whole number.`,
    );
  }

  return value;
}

export async function readCartApiSession(
  request: NextRequest,
  storefrontCode: string,
) {
  const sessionToken =
    readSessionCookie(
      request,
      storefrontCode,
    );

  if (!sessionToken) {
    return null;
  }

  return validateSession({
    storefrontCode,
    sessionToken,
    tokenSecret:
      getAuthTokenSecret(),
  });
}

export function cartSessionRequiredResponse() {
  return authJsonResponse(
    {
      ok: false,
      error: {
        code: "SESSION_INVALID",
        message:
          "Sign in to this storefront to access its cart.",
      },
    },
    401,
  );
}

const cartErrorStatus = {
  VALIDATION: 400,
  CUSTOMER_UNAVAILABLE: 403,
  CART_NOT_FOUND: 404,
  CART_INACTIVE: 409,
  ITEM_NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 409,
  PRICE_UNAVAILABLE: 409,
  QUANTITY_LIMIT: 409,
  INSUFFICIENT_STOCK: 409,
  CONFLICT: 409,
} as const;

export function cartApiErrorResponse(
  error: unknown,
) {
  if (
    error instanceof
    CartServiceError
  ) {
    return authJsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details:
            error.details,
        },
      },
      cartErrorStatus[
        error.code
      ],
    );
  }

  return authApiErrorResponse(error);
}
TS

echo
echo "=== CREATE AUTHENTICATED CART API ROUTES ==="

mkdir -p \
  src/app/api/cart/items/'[itemId]' \
  src/app/api/cart/refresh \
  src/app/api/cart/validate

cat > src/app/api/cart/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  clearActiveCart,
  getOrCreateActiveCart,
} from "../../../server/cart";
import {
  assertTrustedOrigin,
  authJsonResponse,
  readJsonObject,
  requiredString,
} from "../../../server/auth/http";
import {
  cartApiErrorResponse,
  cartSessionRequiredResponse,
  readCartApiSession,
  requireStorefrontCode,
} from "../../../server/cart/http";
import {
  toPublicCartView,
} from "../../../server/cart/presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const storefrontCode =
      requireStorefrontCode(
        request.nextUrl
          .searchParams
          .get("storefrontCode"),
      );

    const session =
      await readCartApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const cart =
      await getOrCreateActiveCart({
        storefrontCode,
        userId: session.userId,
      });

    return authJsonResponse({
      ok: true,
      data: {
        cart:
          toPublicCartView(cart),
      },
    });
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const storefrontCode =
      requireStorefrontCode(
        requiredString(
          body,
          "storefrontCode",
          {
            maxLength: 12,
          },
        ),
      );

    const session =
      await readCartApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const cart =
      await clearActiveCart({
        storefrontCode,
        userId: session.userId,
      });

    return authJsonResponse({
      ok: true,
      data: {
        cart:
          toPublicCartView(cart),
      },
    });
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}
TS

cat > src/app/api/cart/items/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  addCartItem,
} from "../../../../server/cart";
import {
  assertTrustedOrigin,
  authJsonResponse,
  readJsonObject,
  requiredString,
} from "../../../../server/auth/http";
import {
  cartApiErrorResponse,
  cartSessionRequiredResponse,
  readCartApiSession,
  requiredIntegerField,
  requireStorefrontCode,
} from "../../../../server/cart/http";
import {
  toPublicCartView,
} from "../../../../server/cart/presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const storefrontCode =
      requireStorefrontCode(
        requiredString(
          body,
          "storefrontCode",
          {
            maxLength: 12,
          },
        ),
      );

    const session =
      await readCartApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const cart =
      await addCartItem({
        storefrontCode,
        userId: session.userId,
        productVariantId:
          requiredString(
            body,
            "productVariantId",
            {
              maxLength: 191,
            },
          ),
        quantity:
          requiredIntegerField(
            body,
            "quantity",
          ),
      });

    return authJsonResponse(
      {
        ok: true,
        data: {
          cart:
            toPublicCartView(cart),
        },
      },
      201,
    );
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}
TS

cat > src/app/api/cart/items/'[itemId]'/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  removeCartItem,
  updateCartItemQuantity,
} from "../../../../../server/cart";
import {
  assertTrustedOrigin,
  authJsonResponse,
  readJsonObject,
  requiredString,
} from "../../../../../server/auth/http";
import {
  cartApiErrorResponse,
  cartSessionRequiredResponse,
  readCartApiSession,
  requiredIntegerField,
  requireStorefrontCode,
} from "../../../../../server/cart/http";
import {
  toPublicCartView,
} from "../../../../../server/cart/presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CartItemRouteContext {
  params: Promise<{
    itemId: string;
  }>;
}

export async function PATCH(
  request: NextRequest,
  context: CartItemRouteContext,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const storefrontCode =
      requireStorefrontCode(
        requiredString(
          body,
          "storefrontCode",
          {
            maxLength: 12,
          },
        ),
      );

    const session =
      await readCartApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const {
      itemId,
    } = await context.params;

    const cart =
      await updateCartItemQuantity({
        storefrontCode,
        userId: session.userId,
        cartItemId: itemId,
        quantity:
          requiredIntegerField(
            body,
            "quantity",
          ),
      });

    return authJsonResponse({
      ok: true,
      data: {
        cart:
          toPublicCartView(cart),
      },
    });
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: CartItemRouteContext,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const storefrontCode =
      requireStorefrontCode(
        requiredString(
          body,
          "storefrontCode",
          {
            maxLength: 12,
          },
        ),
      );

    const session =
      await readCartApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const {
      itemId,
    } = await context.params;

    const cart =
      await removeCartItem({
        storefrontCode,
        userId: session.userId,
        cartItemId: itemId,
      });

    return authJsonResponse({
      ok: true,
      data: {
        cart:
          toPublicCartView(cart),
      },
    });
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}
TS

cat > src/app/api/cart/refresh/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  refreshActiveCart,
} from "../../../../server/cart";
import {
  assertTrustedOrigin,
  authJsonResponse,
  readJsonObject,
  requiredString,
} from "../../../../server/auth/http";
import {
  cartApiErrorResponse,
  cartSessionRequiredResponse,
  readCartApiSession,
  requireStorefrontCode,
} from "../../../../server/cart/http";
import {
  toPublicCartView,
} from "../../../../server/cart/presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const storefrontCode =
      requireStorefrontCode(
        requiredString(
          body,
          "storefrontCode",
          {
            maxLength: 12,
          },
        ),
      );

    const session =
      await readCartApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const cart =
      await refreshActiveCart({
        storefrontCode,
        userId: session.userId,
      });

    return authJsonResponse({
      ok: true,
      data: {
        cart:
          toPublicCartView(cart),
      },
    });
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}
TS

cat > src/app/api/cart/validate/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  validateActiveCart,
} from "../../../../server/cart";
import {
  authJsonResponse,
} from "../../../../server/auth/http";
import {
  cartApiErrorResponse,
  cartSessionRequiredResponse,
  readCartApiSession,
  requireStorefrontCode,
} from "../../../../server/cart/http";
import {
  toPublicCartValidation,
} from "../../../../server/cart/presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const storefrontCode =
      requireStorefrontCode(
        request.nextUrl
          .searchParams
          .get("storefrontCode"),
      );

    const session =
      await readCartApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const validation =
      await validateActiveCart({
        storefrontCode,
        userId: session.userId,
      });

    return authJsonResponse({
      ok: true,
      data: {
        validation:
          toPublicCartValidation(
            validation,
          ),
      },
    });
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}
TS

echo
echo "=== CREATE STOREFRONT CART COMPONENTS ==="

cat > src/components/cart/storefront-cart.module.css <<'CSS'
.page {
  min-height: 100vh;
  background:
    radial-gradient(
      circle at top right,
      rgba(192, 151, 76, 0.14),
      transparent 34rem
    ),
    #f5f1e8;
  color: #101827;
  padding: 2rem 1rem 5rem;
}

.shell {
  width: min(1180px, 100%);
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.eyebrow {
  margin: 0 0 0.45rem;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7b5e27;
}

.title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 4.5rem);
  line-height: 0.96;
  letter-spacing: -0.055em;
}

.description {
  max-width: 42rem;
  margin: 1rem 0 0;
  color: #5b6472;
  line-height: 1.7;
}

.headerLinks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}

.linkButton,
.secondaryButton,
.primaryButton,
.dangerButton {
  border: 0;
  border-radius: 999px;
  padding: 0.8rem 1.1rem;
  font: inherit;
  font-weight: 750;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.linkButton,
.secondaryButton {
  background: #ffffff;
  color: #101827;
  box-shadow:
    0 12px 35px
    rgba(16, 24, 39, 0.08);
}

.primaryButton {
  background: #101827;
  color: #ffffff;
}

.dangerButton {
  background: #f8e8e8;
  color: #8c2424;
}

.linkButton:hover,
.secondaryButton:hover,
.primaryButton:hover,
.dangerButton:hover {
  transform: translateY(-1px);
}

.linkButton:disabled,
.secondaryButton:disabled,
.primaryButton:disabled,
.dangerButton:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
}

.notice,
.errorNotice,
.successNotice {
  border-radius: 1rem;
  margin-bottom: 1.25rem;
  padding: 0.95rem 1.1rem;
  line-height: 1.55;
}

.notice {
  background: #fff8df;
  color: #725719;
}

.errorNotice {
  background: #fbe6e6;
  color: #8c2424;
}

.successNotice {
  background: #e6f4ec;
  color: #1f6846;
}

.layout {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    minmax(270px, 360px);
  gap: 1.25rem;
  align-items: start;
}

.items,
.summary,
.empty {
  border: 1px solid
    rgba(16, 24, 39, 0.08);
  border-radius: 1.5rem;
  background: rgba(
    255,
    255,
    255,
    0.9
  );
  box-shadow:
    0 24px 70px
    rgba(16, 24, 39, 0.08);
}

.items {
  overflow: hidden;
}

.item {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    auto;
  gap: 1.25rem;
  padding: 1.35rem;
  border-bottom: 1px solid
    rgba(16, 24, 39, 0.08);
}

.item:last-child {
  border-bottom: 0;
}

.itemName {
  margin: 0;
  font-size: 1.05rem;
}

.itemMeta {
  margin: 0.4rem 0 0;
  color: #69717e;
  font-size: 0.9rem;
}

.itemPrice {
  margin: 0.75rem 0 0;
  font-weight: 800;
}

.itemActions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.quantityInput {
  width: 5rem;
  border: 1px solid
    rgba(16, 24, 39, 0.15);
  border-radius: 0.8rem;
  padding: 0.7rem;
  font: inherit;
  text-align: center;
  background: #ffffff;
}

.summary {
  position: sticky;
  top: 1rem;
  padding: 1.4rem;
}

.summaryTitle {
  margin: 0 0 1.2rem;
  font-size: 1.3rem;
}

.summaryRow {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.7rem 0;
  color: #5b6472;
}

.summaryTotal {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid
    rgba(16, 24, 39, 0.12);
  font-size: 1.15rem;
  font-weight: 850;
}

.summaryActions {
  display: grid;
  gap: 0.7rem;
  margin-top: 1.25rem;
}

.empty {
  grid-column: 1 / -1;
  padding: clamp(
    2rem,
    7vw,
    5rem
  );
  text-align: center;
}

.emptyTitle {
  margin: 0;
  font-size: clamp(
    1.7rem,
    4vw,
    3rem
  );
}

.emptyText {
  max-width: 38rem;
  margin: 0.9rem auto 1.4rem;
  color: #69717e;
  line-height: 1.65;
}

.issueList {
  margin: 0 0 1.25rem;
  padding: 1rem 1rem 1rem 2rem;
  border-radius: 1rem;
  background: #fbe6e6;
  color: #8c2424;
}

.checkoutNote {
  margin: 0.8rem 0 0;
  color: #69717e;
  font-size: 0.82rem;
  line-height: 1.5;
}

@media (max-width: 820px) {
  .header {
    flex-direction: column;
  }

  .layout {
    grid-template-columns: 1fr;
  }

  .summary {
    position: static;
  }
}

@media (max-width: 560px) {
  .page {
    padding-inline: 0.75rem;
  }

  .item {
    grid-template-columns: 1fr;
  }

  .itemActions {
    justify-content: flex-start;
  }

  .headerLinks {
    width: 100%;
  }

  .linkButton {
    flex: 1;
    text-align: center;
  }
}
CSS

cat > src/components/cart/storefront-cart.tsx <<'TS'
"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";
import type {
  PublicCartValidationResult,
  PublicCartView,
} from "../../server/cart/types";

import styles from "./storefront-cart.module.css";

interface ApiError {
  message?: string;
}

interface CartEnvelope {
  data?: {
    cart?: PublicCartView;
  };
  error?: ApiError;
}

interface ValidationEnvelope {
  data?: {
    validation?:
      PublicCartValidationResult;
  };
  error?: ApiError;
}

function errorMessage(
  payload:
    | CartEnvelope
    | ValidationEnvelope,
  fallback: string,
): string {
  return (
    payload.error?.message ??
    fallback
  );
}

async function readPayload<T>(
  response: Response,
): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}

export function StorefrontCart({
  storefront,
  initialCart,
}: {
  storefront: StorefrontAuthConfig;
  initialCart: PublicCartView;
}) {
  const [
    cart,
    setCart,
  ] = useState(initialCart);

  const [
    quantities,
    setQuantities,
  ] = useState<
    Record<string, string>
  >({});

  const [
    pending,
    setPending,
  ] = useState<string | null>(
    null,
  );

  const [
    notice,
    setNotice,
  ] = useState<string | null>(
    null,
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    validation,
    setValidation,
  ] = useState<
    PublicCartValidationResult |
    null
  >(null);

  useEffect(() => {
    setQuantities(
      Object.fromEntries(
        cart.items.map(
          (item) => [
            item.id,
            String(item.quantity),
          ],
        ),
      ),
    );
  }, [cart]);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(
        "en-US",
        {
          style: "currency",
          currency:
            cart.currencyCode,
        },
      ),
    [
      cart.currencyCode,
    ],
  );

  function formatMoney(
    value: string,
  ): string {
    return formatter.format(
      Number(value),
    );
  }

  async function requestCart(
    path: string,
    init: RequestInit,
    action: string,
  ): Promise<void> {
    setPending(action);
    setError(null);
    setNotice(null);
    setValidation(null);

    try {
      const response = await fetch(
        path,
        {
          ...init,
          credentials:
            "same-origin",
          headers: {
            "Content-Type":
              "application/json",
            ...(init.headers ?? {}),
          },
        },
      );

      const payload =
        await readPayload<
          CartEnvelope
        >(response);

      if (
        !response.ok ||
        !payload.data?.cart
      ) {
        throw new Error(
          errorMessage(
            payload,
            "The cart could not be updated.",
          ),
        );
      }

      setCart(
        payload.data.cart,
      );

      setNotice(
        "Your cart has been updated.",
      );
    } catch (
      requestError
    ) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The cart could not be updated.",
      );
    } finally {
      setPending(null);
    }
  }

  async function updateQuantity(
    itemId: string,
  ): Promise<void> {
    const quantity =
      Number(
        quantities[itemId],
      );

    await requestCart(
      `/api/cart/items/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          storefrontCode:
            storefront.code,
          quantity,
        }),
      },
      `quantity:${itemId}`,
    );
  }

  async function removeItem(
    itemId: string,
  ): Promise<void> {
    await requestCart(
      `/api/cart/items/${encodeURIComponent(itemId)}`,
      {
        method: "DELETE",
        body: JSON.stringify({
          storefrontCode:
            storefront.code,
        }),
      },
      `remove:${itemId}`,
    );
  }

  async function clearCart(): Promise<void> {
    await requestCart(
      "/api/cart",
      {
        method: "DELETE",
        body: JSON.stringify({
          storefrontCode:
            storefront.code,
        }),
      },
      "clear",
    );
  }

  async function refreshCart(): Promise<void> {
    await requestCart(
      "/api/cart/refresh",
      {
        method: "POST",
        body: JSON.stringify({
          storefrontCode:
            storefront.code,
        }),
      },
      "refresh",
    );
  }

  async function validateCart(): Promise<void> {
    setPending("validate");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/cart/validate?storefrontCode=${encodeURIComponent(storefront.code)}`,
        {
          credentials:
            "same-origin",
        },
      );

      const payload =
        await readPayload<
          ValidationEnvelope
        >(response);

      if (
        !response.ok ||
        !payload.data
          ?.validation
      ) {
        throw new Error(
          errorMessage(
            payload,
            "The cart could not be validated.",
          ),
        );
      }

      setValidation(
        payload.data.validation,
      );

      setCart(
        payload.data.validation
          .cart,
      );

      setNotice(
        payload.data.validation
          .valid
          ? "Your cart is currently valid."
          : "Some cart items require attention.",
      );
    } catch (
      requestError
    ) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The cart could not be validated.",
      );
    } finally {
      setPending(null);
    }
  }

  const storefrontBaseHref =
    storefront.accountHref.replace(
      /\/account$/,
      "",
    );

  const cartHref =
    `${storefrontBaseHref}/cart`;

  const shopHref =
    `${storefrontBaseHref}/shop`;

  return (
    <main
      className={styles.page}
      data-cart-storefront={
        storefront.code
      }
      data-cart-route={cartHref}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>
              {storefront.shortName}
            </p>

            <h1 className={styles.title}>
              Your cart
            </h1>

            <p className={styles.description}>
              This cart belongs only to
              your {storefront.shortName}{" "}
              account. Products, prices,
              currency and sessions remain
              isolated from every other
              SORVYRA storefront.
            </p>
          </div>

          <nav
            className={
              styles.headerLinks
            }
            aria-label="Cart navigation"
          >
            <Link
              className={
                styles.linkButton
              }
              href={shopHref}
            >
              Continue shopping
            </Link>

            <Link
              className={
                styles.linkButton
              }
              href={
                storefront.accountHref
              }
            >
              My account
            </Link>
          </nav>
        </header>

        {error ? (
          <div
            className={
              styles.errorNotice
            }
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            className={
              styles.successNotice
            }
            role="status"
          >
            {notice}
          </div>
        ) : null}

        {validation &&
        !validation.valid ? (
          <ul
            className={
              styles.issueList
            }
          >
            {validation.issues.map(
              (issue) => (
                <li
                  key={
                    issue.cartItemId
                  }
                >
                  {issue.message}
                </li>
              ),
            )}
          </ul>
        ) : null}

        <div className={styles.layout}>
          {cart.items.length === 0 ? (
            <section
              className={styles.empty}
            >
              <h2
                className={
                  styles.emptyTitle
                }
              >
                Your cart is empty.
              </h2>

              <p
                className={
                  styles.emptyText
                }
              >
                Browse this storefront
                and choose the exact
                product variant you need.
              </p>

              <Link
                className={
                  styles.primaryButton
                }
                href={shopHref}
              >
                Browse products
              </Link>
            </section>
          ) : (
            <>
              <section
                className={
                  styles.items
                }
                aria-label="Cart items"
              >
                {cart.items.map(
                  (item) => (
                    <article
                      className={
                        styles.item
                      }
                      key={item.id}
                    >
                      <div>
                        <h2
                          className={
                            styles.itemName
                          }
                        >
                          {
                            item.productName
                          }
                        </h2>

                        <p
                          className={
                            styles.itemMeta
                          }
                        >
                          {
                            item.variantTitle
                          }
                          {" · "}
                          SKU {item.sku}
                        </p>

                        <p
                          className={
                            styles.itemPrice
                          }
                        >
                          {formatMoney(
                            item.unitPrice,
                          )}
                          {" each · "}
                          {formatMoney(
                            item.lineTotal,
                          )}
                          {" total"}
                        </p>
                      </div>

                      <div
                        className={
                          styles.itemActions
                        }
                      >
                        <input
                          className={
                            styles.quantityInput
                          }
                          type="number"
                          min={1}
                          max={999}
                          inputMode="numeric"
                          aria-label={`Quantity for ${item.productName}`}
                          value={
                            quantities[
                              item.id
                            ] ??
                            String(
                              item.quantity,
                            )
                          }
                          onChange={(
                            event,
                          ) => {
                            setQuantities(
                              (
                                current,
                              ) => ({
                                ...current,
                                [item.id]:
                                  event
                                    .target
                                    .value,
                              }),
                            );
                          }}
                        />

                        <button
                          className={
                            styles.secondaryButton
                          }
                          type="button"
                          disabled={
                            pending !== null
                          }
                          onClick={() =>
                            void updateQuantity(
                              item.id,
                            )
                          }
                        >
                          {pending ===
                          `quantity:${item.id}`
                            ? "Updating…"
                            : "Update"}
                        </button>

                        <button
                          className={
                            styles.dangerButton
                          }
                          type="button"
                          disabled={
                            pending !== null
                          }
                          onClick={() =>
                            void removeItem(
                              item.id,
                            )
                          }
                        >
                          {pending ===
                          `remove:${item.id}`
                            ? "Removing…"
                            : "Remove"}
                        </button>
                      </div>
                    </article>
                  ),
                )}
              </section>

              <aside
                className={
                  styles.summary
                }
              >
                <h2
                  className={
                    styles.summaryTitle
                  }
                >
                  Order summary
                </h2>

                <div
                  className={
                    styles.summaryRow
                  }
                >
                  <span>Items</span>
                  <strong>
                    {cart.itemCount}
                  </strong>
                </div>

                {cart.compareAtSubtotal ? (
                  <div
                    className={
                      styles.summaryRow
                    }
                  >
                    <span>
                      Original value
                    </span>
                    <strong>
                      {formatMoney(
                        cart.compareAtSubtotal,
                      )}
                    </strong>
                  </div>
                ) : null}

                {Number(
                  cart.savings,
                ) > 0 ? (
                  <div
                    className={
                      styles.summaryRow
                    }
                  >
                    <span>Savings</span>
                    <strong>
                      {formatMoney(
                        cart.savings,
                      )}
                    </strong>
                  </div>
                ) : null}

                <div
                  className={
                    styles.summaryTotal
                  }
                >
                  <span>Subtotal</span>
                  <span>
                    {formatMoney(
                      cart.subtotal,
                    )}
                  </span>
                </div>

                <div
                  className={
                    styles.summaryActions
                  }
                >
                  <button
                    className={
                      styles.secondaryButton
                    }
                    type="button"
                    disabled={
                      pending !== null
                    }
                    onClick={() =>
                      void refreshCart()
                    }
                  >
                    {pending ===
                    "refresh"
                      ? "Refreshing…"
                      : "Refresh prices"}
                  </button>

                  <button
                    className={
                      styles.secondaryButton
                    }
                    type="button"
                    disabled={
                      pending !== null
                    }
                    onClick={() =>
                      void validateCart()
                    }
                  >
                    {pending ===
                    "validate"
                      ? "Checking…"
                      : "Check availability"}
                  </button>

                  <button
                    className={
                      styles.dangerButton
                    }
                    type="button"
                    disabled={
                      pending !== null
                    }
                    onClick={() =>
                      void clearCart()
                    }
                  >
                    {pending === "clear"
                      ? "Clearing…"
                      : "Clear cart"}
                  </button>

                  <button
                    className={
                      styles.primaryButton
                    }
                    type="button"
                    disabled
                  >
                    Checkout coming next
                  </button>
                </div>

                <p
                  className={
                    styles.checkoutNote
                  }
                >
                  Checkout is intentionally
                  disabled until order,
                  payment and fulfilment
                  protections are added.
                </p>
              </aside>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
TS

cat > src/components/cart/storefront-cart-page.tsx <<'TS'
import {
  getOrCreateActiveCart,
} from "../../server/cart";
import {
  requireStorefrontSession,
} from "../../server/auth/page-session";
import {
  toPublicCartView,
} from "../../server/cart/presentation";
import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";

import {
  StorefrontCart,
} from "./storefront-cart";

export async function StorefrontCartPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  const session =
    await requireStorefrontSession(
      storefront.code,
      storefront.loginHref,
    );

  const cart =
    await getOrCreateActiveCart({
      storefrontCode:
        storefront.code,
      userId: session.userId,
    });

  return (
    <StorefrontCart
      storefront={storefront}
      initialCart={
        toPublicCartView(cart)
      }
    />
  );
}
TS

echo
echo "=== CREATE FOUR STOREFRONT CART PAGES ==="

python - <<'PY'
from pathlib import Path

storefronts = [
    (
        Path(
            "src/app/ng/atiloszy/cart"
        ),
        "ATI",
    ),
    (
        Path(
            "src/app/ng/zee-beauty-fashion/cart"
        ),
        "ZBF",
    ),
    (
        Path(
            "src/app/ng/denald/cart"
        ),
        "DEN",
    ),
    (
        Path(
            "src/app/qa/zee-comfort-hub/cart"
        ),
        "ZCH",
    ),
]

template = '''import {{
  StorefrontCartPage,
}} from "../../../../components/cart/storefront-cart-page";
import {{
  getStorefrontAuthConfig,
}} from "../../../../lib/storefront-auth";

export const dynamic =
  "force-dynamic";

const storefront =
  getStorefrontAuthConfig("{code}");

export default function CartPage() {{
  return (
    <StorefrontCartPage
      storefront={{storefront}}
    />
  );
}}
'''

for directory, code in storefronts:
    directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    (
        directory /
        "page.tsx"
    ).write_text(
        template.format(
            code=code,
        ),
        encoding="utf-8",
    )

    print(
        f"Created protected cart page for {code}."
    )
PY

echo
echo "=== CREATE CART API AND PAGE AUDIT ==="

cat > scripts/audit-cart-api-pages.ts <<'TS'
import {
  type ChildProcessByStdio,
  spawn,
} from "node:child_process";
import {
  randomBytes,
  randomInt,
} from "node:crypto";
import type {
  Readable,
} from "node:stream";

import {
  PriceType,
  ProductStatus,
  StorefrontProductStatus,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  createCatalogProduct,
} from "../src/server/catalog";
import {
  normalizeEmail,
  registerCustomer,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";

type TestServer =
  ChildProcessByStdio<
    null,
    Readable,
    Readable
  >;

interface HttpResult {
  status: number;
  text: string;
  json: unknown;
  setCookie: string | null;
  location: string | null;
}

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function asRecord(
  value: unknown,
): Record<string, unknown> {
  assertCondition(
    typeof value === "object" &&
      value !== null &&
      !Array.isArray(value),
    "Expected an object response.",
  );

  return value as
    Record<string, unknown>;
}

function nestedRecord(
  record:
    Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return asRecord(record[key]);
}

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForExit(
  server: TestServer,
  timeoutMilliseconds: number,
): Promise<boolean> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return true;
  }

  return new Promise((resolve) => {
    let settled = false;

    let timer:
      | ReturnType<typeof setTimeout>
      | null = null;

    const finish = (
      exited: boolean,
    ): void => {
      if (settled) {
        return;
      }

      settled = true;

      if (timer) {
        clearTimeout(timer);
      }

      server.removeListener(
        "exit",
        handleExit,
      );

      resolve(exited);
    };

    const handleExit = (): void => {
      finish(true);
    };

    server.once(
      "exit",
      handleExit,
    );

    timer = setTimeout(
      () => finish(false),
      timeoutMilliseconds,
    );
  });
}

async function stopServer(
  server: TestServer,
): Promise<void> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return;
  }

  server.kill("SIGTERM");

  if (
    await waitForExit(
      server,
      5000,
    )
  ) {
    return;
  }

  server.kill("SIGKILL");

  await waitForExit(
    server,
    2000,
  );
}

async function categorySlugFor(
  storefrontKey: string,
): Promise<string> {
  const storefront =
    await prisma.storefront.findUniqueOrThrow(
      {
        where: {
          key: storefrontKey,
        },
        select: {
          categories: {
            take: 1,
            select: {
              slug: true,
            },
          },
        },
      },
    );

  const category =
    storefront.categories[0];

  assertCondition(
    category,
    `No category exists for ${storefrontKey}.`,
  );

  return category.slug;
}

async function createAuditProduct(
  input: {
    storefrontKey: string;
    skuPrefix: string;
    token: string;
    amount: string;
  },
) {
  return createCatalogProduct({
    storefrontKey:
      input.storefrontKey,
    categorySlug:
      await categorySlugFor(
        input.storefrontKey,
      ),
    listingSlug:
      `cart-api-${input.token}`,
    name:
      `Temporary ${input.storefrontKey} cart API product`,
    shortDescription:
      "Temporary authenticated cart API audit product.",
    description:
      "Automatically removed after the cart API audit.",
    brand:
      "SORVYRA Cart API Audit",
    productStatus:
      ProductStatus.ACTIVE,
    listingStatus:
      StorefrontProductStatus.ACTIVE,
    publishedAt: new Date(
      Date.now() - 60_000,
    ),
    maxPerOrder: 8,
    isDemo: true,
    variant: {
      sku:
        `${input.skuPrefix}-CAPI-${input.token}`,
      title: "Audit variant",
      price: {
        amount: input.amount,
      },
      initialStock: 12,
      reorderLevel: 1,
      isTracked: true,
      allowBackorder: false,
    },
  });
}

async function main(): Promise<void> {
  console.log(
    "=== AUTHENTICATED CART API AND PAGE AUDIT ===",
  );

  const tokenSecret =
    process.env.AUTH_TOKEN_SECRET;

  assertCondition(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const token = randomBytes(7)
    .toString("hex");

  const email =
    `cart-api-${token}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phone =
    `+234708${`${Date.now()}`.slice(-7)}`;

  const password =
    `Cart-API-Passphrase-${token}`;

  const productIds:
    string[] = [];

  const registration =
    await registerCustomer({
      storefrontCode: "ATI",
      email,
      phone,
      password,
      firstName: "Cart",
      lastName: "API Audit",
      displayName:
        "ATI Cart API Audit",
      marketingOptIn: false,
      termsAccepted: true,
      privacyAccepted: true,
      tokenSecret,
    });

  await verifyCustomerEmail({
    storefrontCode: "ATI",
    token:
      registration
        .emailVerificationToken,
    tokenSecret,
  });

  await verifyCustomerPhone({
    storefrontCode: "ATI",
    challengeId:
      registration.phoneChallengeId,
    code:
      registration
        .phoneVerificationCode,
    tokenSecret,
  });

  const atiProduct =
    await createAuditProduct({
      storefrontKey: "atiloszy",
      skuPrefix: "ATI",
      token: `${token}-ati`,
      amount: "15000.00",
    });

  const zbfProduct =
    await createAuditProduct({
      storefrontKey:
        "zee-beauty-fashion",
      skuPrefix: "ZBF",
      token: `${token}-zbf`,
      amount: "19000.00",
    });

  productIds.push(
    atiProduct.productId,
    zbfProduct.productId,
  );

  const port = randomInt(
    45001,
    51000,
  );

  const baseUrl =
    `http://127.0.0.1:${port}`;

  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      String(port),
      "-H",
      "127.0.0.1",
    ],
    {
      env: {
        ...process.env,
        APP_ORIGIN: baseUrl,
      },
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    },
  );

  let serverLogs = "";

  const captureLogs = (
    chunk: Buffer,
  ): void => {
    serverLogs = (
      serverLogs +
      chunk.toString("utf8")
    ).slice(-18000);
  };

  server.stdout.on(
    "data",
    captureLogs,
  );

  server.stderr.on(
    "data",
    captureLogs,
  );

  async function request(
    method: string,
    path: string,
    input?: {
      body?: unknown;
      cookie?: string;
      origin?: string;
    },
  ): Promise<HttpResult> {
    const headers:
      Record<string, string> = {
        Accept: "application/json",
      };

    if (
      input?.body !== undefined
    ) {
      headers["Content-Type"] =
        "application/json";

      headers.Origin =
        input.origin ??
        baseUrl;
    }

    if (input?.cookie) {
      headers.Cookie =
        input.cookie;
    }

    const response = await fetch(
      `${baseUrl}${path}`,
      {
        method,
        headers,
        body:
          input?.body === undefined
            ? undefined
            : JSON.stringify(
                input.body,
              ),
        redirect: "manual",
      },
    );

    const text =
      await response.text();

    let json: unknown = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    return {
      status: response.status,
      text,
      json,
      setCookie:
        response.headers.get(
          "set-cookie",
        ),
      location:
        response.headers.get(
          "location",
        ),
    };
  }

  try {
    let ready = false;

    for (
      let attempt = 0;
      attempt < 60;
      attempt += 1
    ) {
      if (server.exitCode !== null) {
        break;
      }

      try {
        const response =
          await fetch(baseUrl);

        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // Server is still starting.
      }

      await delay(500);
    }

    if (!ready) {
      throw new Error(
        "The production server did not become ready.\n" +
        serverLogs,
      );
    }

    console.log(
      "PASS: Production Next.js server started.",
    );

    for (
      const cartPath of [
        "/ng/atiloszy/cart",
        "/ng/zee-beauty-fashion/cart",
        "/ng/denald/cart",
        "/qa/zee-comfort-hub/cart",
      ]
    ) {
      const response =
        await request(
          "GET",
          cartPath,
        );

      assertCondition(
        response.status >= 300 &&
          response.status < 400,
        `${cartPath} was not protected.`,
      );
    }

    console.log(
      "PASS: All storefront cart pages require authentication.",
    );

    const unauthenticatedApi =
      await request(
        "GET",
        "/api/cart?storefrontCode=ATI",
      );

    assertCondition(
      unauthenticatedApi.status ===
        401,
      "Unauthenticated cart API access was accepted.",
    );

    console.log(
      "PASS: Cart APIs require a storefront session.",
    );

    const login =
      await request(
        "POST",
        "/api/auth/login",
        {
          body: {
            storefrontCode: "ATI",
            email,
            password,
          },
        },
      );

    assertCondition(
      login.status === 200,
      "The audit customer could not sign in.",
    );

    assertCondition(
      login.setCookie,
      "Login did not set a session cookie.",
    );

    const cookiePair =
      login.setCookie.split(";")[0];

    const cartPage =
      await request(
        "GET",
        "/ng/atiloszy/cart",
        {
          cookie: cookiePair,
        },
      );

    assertCondition(
      cartPage.status === 200,
      "The authenticated ATI cart page did not load.",
    );

    assertCondition(
      cartPage.text.includes(
        'data-cart-storefront="ATI"',
      ),
      "The ATI cart page marker was not rendered.",
    );

    console.log(
      "PASS: Authenticated storefront cart page rendered.",
    );

    const initialCart =
      await request(
        "GET",
        "/api/cart?storefrontCode=ATI",
        {
          cookie: cookiePair,
        },
      );

    assertCondition(
      initialCart.status === 200,
      "The active cart API failed.",
    );

    assertCondition(
      !initialCart.text.includes(
        registration.user.id,
      ),
      "The cart API exposed the internal user ID.",
    );

    const initialRoot =
      asRecord(
        initialCart.json,
      );

    const initialData =
      nestedRecord(
        initialRoot,
        "data",
      );

    const initialView =
      nestedRecord(
        initialData,
        "cart",
      );

    assertCondition(
      initialView.itemCount === 0,
      "The initial API cart was not empty.",
    );

    console.log(
      "PASS: Active cart API returns a safe public view.",
    );

    const crossOrigin =
      await request(
        "POST",
        "/api/cart/items",
        {
          cookie: cookiePair,
          origin:
            "https://malicious.example",
          body: {
            storefrontCode: "ATI",
            productVariantId:
              atiProduct.variantId,
            quantity: 1,
          },
        },
      );

    assertCondition(
      crossOrigin.status === 403,
      "Cross-origin cart mutation was accepted.",
    );

    console.log(
      "PASS: Cross-origin cart mutations are rejected.",
    );

    const wrongStoreProduct =
      await request(
        "POST",
        "/api/cart/items",
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
            productVariantId:
              zbfProduct.variantId,
            quantity: 1,
          },
        },
      );

    assertCondition(
      wrongStoreProduct.status ===
        409,
      "A cross-store product was accepted.",
    );

    console.log(
      "PASS: API product storefront isolation completed.",
    );

    const added =
      await request(
        "POST",
        "/api/cart/items",
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
            productVariantId:
              atiProduct.variantId,
            quantity: 2,
          },
        },
      );

    assertCondition(
      added.status === 201,
      "A valid cart item could not be added.",
    );

    const addedCart =
      nestedRecord(
        nestedRecord(
          asRecord(added.json),
          "data",
        ),
        "cart",
      );

    assertCondition(
      addedCart.itemCount === 2,
      "The added quantity was incorrect.",
    );

    const addedItems =
      addedCart.items;

    assertCondition(
      Array.isArray(addedItems) &&
        addedItems.length === 1,
      "The added cart line was missing.",
    );

    const addedItem =
      asRecord(
        addedItems[0],
      );

    const itemId =
      addedItem.id;

    assertCondition(
      typeof itemId === "string",
      "The cart item ID was missing.",
    );

    console.log(
      "PASS: Authenticated cart item creation completed.",
    );

    const updated =
      await request(
        "PATCH",
        `/api/cart/items/${encodeURIComponent(itemId)}`,
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
            quantity: 3,
          },
        },
      );

    assertCondition(
      updated.status === 200,
      "The cart quantity update failed.",
    );

    const updatedCart =
      nestedRecord(
        nestedRecord(
          asRecord(updated.json),
          "data",
        ),
        "cart",
      );

    assertCondition(
      updatedCart.itemCount === 3,
      "The updated quantity was incorrect.",
    );

    assertCondition(
      updatedCart.subtotal ===
        "45000.00",
      "The updated cart subtotal was incorrect.",
    );

    console.log(
      "PASS: Authenticated cart quantity updates completed.",
    );

    const validation =
      await request(
        "GET",
        "/api/cart/validate?storefrontCode=ATI",
        {
          cookie: cookiePair,
        },
      );

    assertCondition(
      validation.status === 200,
      "The cart validation endpoint failed.",
    );

    const validationView =
      nestedRecord(
        nestedRecord(
          asRecord(validation.json),
          "data",
        ),
        "validation",
      );

    assertCondition(
      validationView.valid === true,
      "A valid cart was reported as invalid.",
    );

    console.log(
      "PASS: Authenticated cart validation completed.",
    );

    const storefront =
      await prisma.storefront.findUniqueOrThrow(
        {
          where: {
            code: "ATI",
          },
        },
      );

    await prisma.storefrontPrice.create({
      data: {
        productVariantId:
          atiProduct.variantId,
        currencyCode:
          storefront.currencyCode,
        type: PriceType.SALE,
        amount: "12000.00",
        compareAtAmount:
          "15000.00",
        isActive: true,
        startsAt: new Date(
          Date.now() - 60_000,
        ),
      },
    });

    const refreshed =
      await request(
        "POST",
        "/api/cart/refresh",
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
          },
        },
      );

    assertCondition(
      refreshed.status === 200,
      "The cart refresh endpoint failed.",
    );

    const refreshedCart =
      nestedRecord(
        nestedRecord(
          asRecord(refreshed.json),
          "data",
        ),
        "cart",
      );

    assertCondition(
      refreshedCart.subtotal ===
        "36000.00",
      "The refreshed sale subtotal was incorrect.",
    );

    console.log(
      "PASS: Authenticated cart price refresh completed.",
    );

    const removed =
      await request(
        "DELETE",
        `/api/cart/items/${encodeURIComponent(itemId)}`,
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
          },
        },
      );

    assertCondition(
      removed.status === 200,
      "The cart item removal failed.",
    );

    const removedCart =
      nestedRecord(
        nestedRecord(
          asRecord(removed.json),
          "data",
        ),
        "cart",
      );

    assertCondition(
      removedCart.itemCount === 0,
      "The cart item was not removed.",
    );

    await request(
      "POST",
      "/api/cart/items",
      {
        cookie: cookiePair,
        body: {
          storefrontCode: "ATI",
          productVariantId:
            atiProduct.variantId,
          quantity: 1,
        },
      },
    );

    const cleared =
      await request(
        "DELETE",
        "/api/cart",
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
          },
        },
      );

    assertCondition(
      cleared.status === 200,
      "The cart clear endpoint failed.",
    );

    const clearedCart =
      nestedRecord(
        nestedRecord(
          asRecord(cleared.json),
          "data",
        ),
        "cart",
      );

    assertCondition(
      clearedCart.itemCount === 0,
      "The cart was not cleared.",
    );

    console.log(
      "PASS: Authenticated cart removal and clearing completed.",
    );

    const isolatedSession =
      await request(
        "GET",
        "/api/cart?storefrontCode=ZBF",
        {
          cookie: cookiePair,
        },
      );

    assertCondition(
      isolatedSession.status === 401,
      "An ATI session accessed the ZBF cart.",
    );

    console.log(
      "PASS: Cart sessions remain storefront-isolated.",
    );

    console.log(
      "PASS: Authenticated cart API and page audit completed.",
    );
  } catch (error) {
    if (serverLogs) {
      console.error(
        "=== PRODUCTION SERVER LOG TAIL ===",
      );

      console.error(serverLogs);
    }

    throw error;
  } finally {
    await stopServer(server);

    await prisma.user.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    if (productIds.length > 0) {
      await prisma.product.deleteMany({
        where: {
          id: {
            in: productIds,
          },
        },
      });
    }

    console.log(
      "PASS: Temporary cart API audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
TS

echo
echo "=== REGISTER CART API AUDIT ==="

npm pkg set \
  "scripts.db:audit:cart-api=node --env-file=.env --conditions=react-server --import tsx scripts/audit-cart-api-pages.ts"

run_quiet \
  "VALIDATE DATABASE SCHEMA" \
  npm run db:validate

run_quiet \
  "GENERATE PRISMA CLIENT" \
  npm run db:generate

run_quiet \
  "VERIFY MIGRATION STATUS" \
  npx prisma migrate status

run_quiet \
  "CART SERVICE AUDIT" \
  npm run db:audit:cart-services

run_quiet \
  "CART FOUNDATION AUDIT" \
  npm run db:audit:cart

run_quiet \
  "ESLINT" \
  npm run lint

run_quiet \
  "PRODUCTION BUILD" \
  npm run build

echo
echo "=== RUN AUTHENTICATED CART API AND PAGE AUDIT ==="

if npm run db:audit:cart-api \
  2>&1 |
  tee -a "$DETAIL_LOG"
then
  echo "PASS: Authenticated cart API and page audit"
else
  echo "FAIL: Authenticated cart API and page audit"
  exit 1
fi

run_quiet \
  "AUTHENTICATION API REGRESSION AUDIT" \
  npm run db:audit:auth-api

run_quiet \
  "AUTHENTICATION PAGE REGRESSION AUDIT" \
  npm run db:audit:auth-ui

run_quiet \
  "CUSTOMER IDENTITY REGRESSION AUDIT" \
  npm run db:audit:identity

run_quiet \
  "CATALOGUE SERVICE REGRESSION AUDIT" \
  npm run db:audit:services

run_quiet \
  "RECOVERY HTTP REGRESSION AUDIT" \
  npm run db:audit:recovery-http

echo
echo "=== VERIFY AUDIT CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TS'
import { prisma } from "./src/lib/prisma";

const temporaryUsers =
  await prisma.user.count({
    where: {
      normalizedEmail: {
        contains:
          "cart-api-",
        endsWith:
          "@example.test",
      },
    },
  });

const temporaryProducts =
  await prisma.product.count({
    where: {
      slug: {
        contains:
          "cart-api-",
      },
    },
  });

if (
  temporaryUsers !== 0 ||
  temporaryProducts !== 0
) {
  throw new Error(
    [
      `${temporaryUsers} temporary customer(s) remain.`,
      `${temporaryProducts} temporary product(s) remain.`,
    ].join(" "),
  );
}

console.log(
  "PASS: No temporary cart API audit records remain.",
);

await prisma.$disconnect();
TS

echo
echo "=== VERIFY NO TEST SERVER REMAINS ==="

if ps -ef |
  grep -E \
    '[n]ode_modules/next/dist/bin/next start' \
  >/tmp/sorvyra-cart-api-server-check.txt
then
  echo "A temporary Next.js test server remains:"
  cat /tmp/sorvyra-cart-api-server-check.txt
  exit 1
fi

echo "PASS: No temporary test server remains."

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "Detailed validation log:"
echo "$DETAIL_LOG"

echo
echo "PHASE 2F-C AUTHENTICATED CART API AND PAGES PASSED"
