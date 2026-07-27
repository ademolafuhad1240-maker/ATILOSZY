#!/usr/bin/env bash

set -Eeuo pipefail

DETAIL_LOG="/tmp/sorvyra-phase-2h-b-details.log"
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
    tail -n 260 "$DETAIL_LOG"
    exit 1
  fi
}

echo "=== VERIFY PHASE 2H-B FILES ==="

test "$(git branch --show-current)" = \
  "feat/commerce-foundation"

test -f \
  src/server/payments/errors.ts
test -f \
  src/server/payments/types.ts
test -f \
  src/server/payments/service.ts
test -f \
  src/server/payments/index.ts
test -f \
  scripts/audit-payment-transitions.ts
test -f \
  scripts/setup-payment-transitions.sh

echo "PASS: Payment transition service and audit files exist."

npm pkg set \
  "scripts.db:audit:payment-transitions=node --env-file=.env --conditions=react-server --import tsx scripts/audit-payment-transitions.ts"

echo
echo "=== VERIFY NO PRISMA CHANGE ==="

if git status --porcelain |
  grep -E \
    'prisma/schema\.prisma|prisma/migrations/'
then
  echo "Phase 2H-B must not change Prisma schema or migrations."
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
echo "=== RUN PAYMENT TRANSITION AUDIT ==="

if npm run \
  db:audit:payment-transitions \
  2>&1 |
  tee -a "$DETAIL_LOG"
then
  echo "PASS: PAYMENT TRANSITION AUDIT"
else
  echo "FAIL: PAYMENT TRANSITION AUDIT"
  exit 1
fi

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
echo "=== VERIFY NO PAYMENT PROVIDER IMPLEMENTATION ==="

python - <<'PY'
from pathlib import Path
import json

runtime_paths = [
    Path(
        "src/server/payments/errors.ts"
    ),
    Path(
        "src/server/payments/types.ts"
    ),
    Path(
        "src/server/payments/service.ts"
    ),
    Path(
        "src/server/payments/index.ts"
    ),
]

content = "\n".join(
    path.read_text(
        encoding="utf-8",
    )
    for path in runtime_paths
)

for forbidden in [
    "Flutterwave",
    "Paystack",
    "Stripe",
    "PayPal",
    "webhookSecret",
    "secretKey",
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
        "Provider dependency installed:\n" +
        "\n".join(
            sorted(installed)
        )
    )

print(
    "PASS: Payment transitions remain provider-neutral."
)
print(
    "PASS: No provider dependency or credential contract was added."
)
PY

echo
echo "=== VERIFY NO PAYMENT API OR WEBHOOK ROUTE ==="

python - <<'PY'
from pathlib import Path

routes = [
    path
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

if routes:
    raise RuntimeError(
        "Phase 2H-B must not add payment routes:\n" +
        "\n".join(
            str(path)
            for path in routes
        )
    )

print(
    "PASS: No payment, callback or webhook route was added."
)
PY

echo
echo "=== VERIFY INVENTORY IS READ-ONLY IN PAYMENT SERVICE ==="

python - <<'PY'
from pathlib import Path

content = Path(
    "src/server/payments/service.ts"
).read_text(
    encoding="utf-8",
)

for forbidden in [
    "quantityReserved",
    "quantityOnHand",
    "transaction.inventory.update",
    "transaction.inventory.updateMany",
    "UPDATE inventories",
    "stockMovement",
]:
    if forbidden in content:
        raise RuntimeError(
            f"Payment service unexpectedly mutates inventory: {forbidden}"
        )

print(
    "PASS: Payment transitions do not mutate inventory."
)
PY

echo
echo "=== VERIFY AUDIT CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TSCLEAN'
import {
  prisma,
} from "./src/lib/prisma";

const events =
  await prisma.paymentProviderEvent.count({
    where: {
      provider: {
        startsWith:
          "audit-transition-",
      },
    },
  });

const users =
  await prisma.user.count({
    where: {
      email: {
        startsWith:
          "payment-transition-",
      },
    },
  });

if (
  events !== 0 ||
  users !== 0
) {
  throw new Error(
    `Temporary records remain: events=${events}, users=${users}`,
  );
}

console.log(
  "PASS: No temporary payment transition records remain.",
);

await prisma.$disconnect();
TSCLEAN

echo
echo "=== VERIFY GENERATED AND PRIVATE FILES REMAIN EXCLUDED ==="

if git status --porcelain |
  grep -E \
    'src/generated/prisma|(^|/)\.env'
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
echo "PHASE 2H-B PROVIDER-NEUTRAL PRODUCT PAYMENT TRANSITIONS PASSED"
