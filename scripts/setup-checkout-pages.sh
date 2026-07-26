#!/usr/bin/env bash

set -Eeuo pipefail

DETAIL_LOG="/tmp/sorvyra-phase-2g-d-details.log"
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
    tail -n 240 "$DETAIL_LOG"
    exit 1
  fi
}

echo "=== VERIFY PHASE 2G-D FILES ==="

test "$(git branch --show-current)" = \
  "feat/commerce-foundation"

for file in \
  src/lib/storefront-checkout.ts \
  src/components/checkout/storefront-checkout-page.tsx \
  src/components/checkout/storefront-checkout.tsx \
  src/components/checkout/storefront-checkout.module.css \
  src/components/orders/storefront-order-page.tsx \
  src/components/orders/storefront-order.tsx \
  src/components/orders/storefront-order.module.css \
  src/app/ng/atiloszy/checkout/page.tsx \
  src/app/ng/zee-beauty-fashion/checkout/page.tsx \
  src/app/ng/denald/checkout/page.tsx \
  src/app/qa/zee-comfort-hub/checkout/page.tsx \
  'src/app/ng/atiloszy/account/orders/[orderNumber]/page.tsx' \
  'src/app/ng/zee-beauty-fashion/account/orders/[orderNumber]/page.tsx' \
  'src/app/ng/denald/account/orders/[orderNumber]/page.tsx' \
  'src/app/qa/zee-comfort-hub/account/orders/[orderNumber]/page.tsx' \
  scripts/audit-checkout-pages.ts \
  scripts/setup-checkout-pages.sh
do
  test -f "$file"
done

if git status --porcelain |
  grep -E \
    'prisma/schema\.prisma|prisma/migrations/'
then
  echo "Phase 2G-D must not change Prisma schema or migrations."
  exit 1
fi

echo "PASS: Checkout and order page files exist."
echo "PASS: No Prisma schema or migration change is present."

npm pkg set \
  "scripts.db:audit:checkout-pages=node --env-file=.env --conditions=react-server --import tsx scripts/audit-checkout-pages.ts"

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
echo "=== RUN CHECKOUT PAGE AUDIT ==="

if npm run db:audit:checkout-pages \
  2>&1 |
  tee -a "$DETAIL_LOG"
then
  echo "PASS: CHECKOUT PAGE AUDIT"
else
  echo "FAIL: CHECKOUT PAGE AUDIT"
  echo
  echo "Next.js server log:"
  tail -n 180 \
    /tmp/sorvyra-phase-2g-d-next-server.log \
    2>/dev/null \
    || true
  exit 1
fi

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
echo "=== VERIFY NO NEW MIGRATION ==="

python - <<'PY'
from pathlib import Path
import subprocess

tracked = set(
    subprocess.check_output(
        [
            "git",
            "ls-files",
            "prisma/migrations/*/migration.sql",
        ],
        text=True,
    ).splitlines()
)

current = {
    str(path)
    for path in Path(
        "prisma/migrations"
    ).glob(
        "*/migration.sql"
    )
}

if current != tracked:
    raise RuntimeError(
        "Phase 2G-D unexpectedly changed the migration set.\n"
        f"Tracked: {sorted(tracked)}\n"
        f"Current: {sorted(current)}"
    )

print(
    "PASS: Phase 2G-D created no Prisma migration."
)
PY

echo
echo "=== VERIFY NO TEMPORARY SERVER REMAINS ==="

if ps -ef |
  grep -E \
    '[n]ode_modules/next/dist/bin/next start' \
  >/tmp/sorvyra-phase-2g-d-server-check.txt
then
  echo "A temporary Next.js server remains:"
  cat \
    /tmp/sorvyra-phase-2g-d-server-check.txt
  exit 1
fi

echo "PASS: No temporary test server remains."

echo
echo "=== VERIFY CHECKOUT ROUTE SET ==="

python - <<'PY'
from pathlib import Path

expected = {
    "src/app/ng/atiloszy/checkout/page.tsx",
    "src/app/ng/zee-beauty-fashion/checkout/page.tsx",
    "src/app/ng/denald/checkout/page.tsx",
    "src/app/qa/zee-comfort-hub/checkout/page.tsx",
    "src/app/ng/atiloszy/account/orders/[orderNumber]/page.tsx",
    "src/app/ng/zee-beauty-fashion/account/orders/[orderNumber]/page.tsx",
    "src/app/ng/denald/account/orders/[orderNumber]/page.tsx",
    "src/app/qa/zee-comfort-hub/account/orders/[orderNumber]/page.tsx",
}

missing = {
    path
    for path in expected
    if not Path(path).exists()
}

if missing:
    raise RuntimeError(
        "Checkout page routes are missing:\n" +
        "\n".join(
            sorted(missing)
        )
    )

print(
    "PASS: Four checkout and four order-detail page routes exist."
)
PY

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "Detailed validation log:"
echo "$DETAIL_LOG"

echo
echo "PHASE 2G-D STOREFRONT CHECKOUT AND ORDER PAGES PASSED"
