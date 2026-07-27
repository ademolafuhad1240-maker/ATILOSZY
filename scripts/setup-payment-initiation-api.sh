#!/usr/bin/env bash

set -Eeuo pipefail

DETAIL_LOG="/tmp/sorvyra-phase-2h-c-details.log"
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
    tail -n 280 \
      "$DETAIL_LOG"
    exit 1
  fi
}

echo "=== VERIFY PHASE 2H-C FILES ==="

test "$(git branch --show-current)" = \
  "feat/commerce-foundation"

test -f \
  src/server/payments/initiation.ts

test -f \
  src/server/payments/http.ts

test -f \
  'src/app/api/orders/[orderNumber]/payment/initiate/route.ts'

test -f \
  scripts/audit-payment-initiation-api.ts

test -f \
  scripts/setup-payment-initiation-api.sh

grep -q \
  'PAYMENT_INITIATION_PROVIDER=disabled' \
  .env.example

echo "PASS: Payment initiation API, provider contract and audit files exist."

npm pkg set \
  "scripts.db:audit:payment-initiation-api=node --env-file=.env --conditions=react-server --import tsx scripts/audit-payment-initiation-api.ts"

echo
echo "=== VERIFY NO PRISMA CHANGE ==="

if git status --porcelain |
  grep -E \
    'prisma/schema\.prisma|prisma/migrations/'
then
  echo "Phase 2H-C must not change Prisma schema or migrations."
  exit 1
fi

echo "PASS: No Prisma schema or migration changes are present."

run_quiet \
  "VALIDATE DATABASE SCHEMA" \
  npm run db:validate

run_quiet \
  "VERIFY MIGRATION STATUS" \
  npx prisma migrate status

run_quiet \
  "ESLINT" \
  npm run lint

run_quiet \
  "PRODUCTION BUILD" \
  npm run build

echo
echo "=== RUN PAYMENT INITIATION API AUDIT ==="

if npm run \
  db:audit:payment-initiation-api \
  2>&1 |
  tee -a "$DETAIL_LOG"
then
  echo "PASS: PAYMENT INITIATION API AUDIT"
else
  echo "FAIL: PAYMENT INITIATION API AUDIT"
  exit 1
fi

run_quiet \
  "PAYMENT TRANSITION REGRESSION AUDIT" \
  npm run db:audit:payment-transitions

run_quiet \
  "PAYMENT EVENT FOUNDATION REGRESSION AUDIT" \
  npm run db:audit:payment-events

run_quiet \
  "CHECKOUT PAGE REGRESSION AUDIT" \
  npm run db:audit:checkout-pages

run_quiet \
  "CHECKOUT API REGRESSION AUDIT" \
  npm run db:audit:checkout-api

run_quiet \
  "CHECKOUT SERVICE REGRESSION AUDIT" \
  npm run db:audit:checkout-services

run_quiet \
  "ORDER FOUNDATION REGRESSION AUDIT" \
  npm run db:audit:orders

run_quiet \
  "CART FOUNDATION REGRESSION AUDIT" \
  npm run db:audit:cart

run_quiet \
  "CART SERVICE REGRESSION AUDIT" \
  npm run db:audit:cart-services

run_quiet \
  "CART API REGRESSION AUDIT" \
  npm run db:audit:cart-api

run_quiet \
  "CATALOGUE SERVICE REGRESSION AUDIT" \
  npm run db:audit:services

run_quiet \
  "CUSTOMER IDENTITY REGRESSION AUDIT" \
  npm run db:audit:identity

run_quiet \
  "AUTHENTICATION API REGRESSION AUDIT" \
  npm run db:audit:auth-api

run_quiet \
  "LIVE CATALOGUE REGRESSION AUDIT" \
  npm run db:audit:live-catalog

run_quiet \
  "LEGACY CART RETIREMENT REGRESSION AUDIT" \
  npm run db:audit:legacy-cart-retirement

echo
echo "=== VERIFY PROVIDER-NEUTRAL DISABLED CONFIGURATION ==="

python - <<'PY'
from pathlib import Path
import json

runtime_files = [
    Path(
        "src/server/payments/initiation.ts"
    ),
    Path(
        "src/server/payments/http.ts"
    ),
    Path(
        "src/app/api/orders/[orderNumber]/payment/initiate/route.ts"
    ),
]

content = "\n".join(
    path.read_text(
        encoding="utf-8",
    )
    for path in runtime_files
)

required = [
    "PAYMENT_INITIATION_PROVIDER",
    "createDisabledPaymentInitiationProvider",
    "assertPaymentInitiationEnabled",
    "createServerPaymentAttemptIdentity",
    "assertTrustedOrigin",
    "readCheckoutApiSession",
    "getCheckoutOrder",
    "initiateProductPayment",
]

for value in required:
    if value not in content:
        raise RuntimeError(
            f"Payment initiation contract is missing: {value}"
        )

for forbidden in [
    "Flutterwave",
    "Paystack",
    "Stripe",
    "PayPal",
    "Adyen",
    "Mollie",
    "secretKey",
    "webhookSecret",
    "paymentIntent",
    "checkoutSession",
]:
    if forbidden in content:
        raise RuntimeError(
            f"Provider-specific runtime code detected: {forbidden}"
        )

package_json = json.loads(
    Path(
        "package.json"
    ).read_text(
        encoding="utf-8",
    )
)

dependencies = {
    **package_json.get(
        "dependencies",
        {},
    ),
    **package_json.get(
        "devDependencies",
        {},
    ),
}

provider_terms = [
    "stripe",
    "flutterwave",
    "paystack",
    "paypal",
    "adyen",
    "mollie",
]

installed = [
    name
    for name in dependencies
    if any(
        term in name.lower()
        for term in provider_terms
    )
]

if installed:
    raise RuntimeError(
        "Provider-specific dependency installed:\n" +
        "\n".join(
            sorted(installed)
        )
    )

print(
    "PASS: Product payment initiation remains provider-neutral."
)
print(
    "PASS: Payment initiation is disabled until a verified adapter is installed."
)
print(
    "PASS: No payment-provider dependency or credential contract was added."
)
PY

echo
echo "=== VERIFY ROUTE SCOPE ==="

python - <<'PY'
from pathlib import Path

routes = [
    str(path)
    for path in Path(
        "src/app/api"
    ).rglob(
        "route.ts"
    )
    if any(
        term in str(path).lower()
        for term in [
            "payment",
            "webhook",
            "callback",
        ]
    )
]

expected = [
    "src/app/api/orders/[orderNumber]/payment/initiate/route.ts",
]

if routes != expected:
    raise RuntimeError(
        "Unexpected payment, callback or webhook route set.\n"
        f"Expected: {expected}\n"
        f"Actual: {routes}"
    )

print(
    "PASS: Only the authenticated product-payment initiation route exists."
)
print(
    "PASS: No callback or webhook route was added."
)
PY

echo
echo "=== VERIFY CUSTOMER CANNOT CONTROL PAYMENT AUTHORITY ==="

python - <<'PY'
from pathlib import Path

content = Path(
    "src/server/payments/http.ts"
).read_text(
    encoding="utf-8",
)

required_rejections = [
    '"provider"',
    '"providerReference"',
    '"merchantReference"',
    '"idempotencyKey"',
    '"providerMetadata"',
    '"amount"',
    '"currencyCode"',
    '"orderId"',
    '"userId"',
    '"paymentStatus"',
    '"outcome"',
    '"signatureVerified"',
]

for value in required_rejections:
    if value not in content:
        raise RuntimeError(
            f"Customer-controlled payment field is not rejected: {value}"
        )

required_server_controls = [
    "createServerPaymentAttemptIdentity",
    "order.productTotal",
    "order.currencyCode",
    "session.userId",
    "provider.name",
    "providerResult",
]

for value in required_server_controls:
    if value not in content:
        raise RuntimeError(
            f"Server-controlled payment authority is missing: {value}"
        )

print(
    "PASS: Provider, references, amount, currency, user and payment state remain server-controlled."
)
PY

echo
echo "=== VERIFY PRIVATE PAYMENT VALUES ARE NOT RETURNED ==="

python - <<'PY'
from pathlib import Path

content = Path(
    "src/server/payments/http.ts"
).read_text(
    encoding="utf-8",
)

start = content.find(
    "export function toPublicProductPaymentView"
)

end = content.find(
    "export function paymentJsonResponse",
    start,
)

if (
    start < 0 or
    end < 0
):
    raise RuntimeError(
        "Could not isolate the public payment mapper."
    )

mapper = content[
    start:end
]

for forbidden in [
    "storefrontId:",
    "provider:",
    "providerReference:",
    "idempotencyKey:",
]:
    if forbidden in mapper:
        raise RuntimeError(
            f"Public payment mapper leaks: {forbidden}"
        )

print(
    "PASS: Public payment response excludes provider references and idempotency keys."
)
PY

echo
echo "=== VERIFY PAYMENT SERVICE DOES NOT MUTATE INVENTORY ==="

python - <<'PY'
from pathlib import Path

content = "\n".join([
    Path(
        "src/server/payments/service.ts"
    ).read_text(
        encoding="utf-8",
    ),
    Path(
        "src/server/payments/http.ts"
    ).read_text(
        encoding="utf-8",
    ),
    Path(
        "src/server/payments/initiation.ts"
    ).read_text(
        encoding="utf-8",
    ),
])

for forbidden in [
    "quantityReserved",
    "quantityOnHand",
    "UPDATE inventories",
    "transaction.inventory.update",
    "transaction.inventory.updateMany",
    "stockMovement",
]:
    if forbidden in content:
        raise RuntimeError(
            f"Payment runtime unexpectedly mutates inventory: {forbidden}"
        )

print(
    "PASS: Payment API and transitions do not mutate inventory reservations or stock."
)
PY

echo
echo "=== VERIFY GENERATED AND PRIVATE FILES REMAIN EXCLUDED ==="

if git status --porcelain |
  grep -E \
    'src/generated/prisma|(^|/)\.env$|(^|/)\.env\.local$'
then
  echo "Generated Prisma client or private environment file appears in Git status."
  exit 1
fi

echo "PASS: Generated client and private environment files remain excluded."

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "Detailed validation log:"
echo "$DETAIL_LOG"

echo
echo "PHASE 2H-C AUTHENTICATED PRODUCT PAYMENT INITIATION API PASSED"
