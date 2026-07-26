#!/usr/bin/env bash

set -Eeuo pipefail

DETAIL_LOG="/tmp/sorvyra-phase-2g-c-details.log"
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
    tail -n 220 "$DETAIL_LOG"
    exit 1
  fi
}

echo "=== VERIFY PHASE 2G-C FILES ==="

test "$(git branch --show-current)" = \
  "feat/commerce-foundation"

for file in \
  src/server/checkout/http.ts \
  src/app/api/checkout/route.ts \
  'src/app/api/orders/[orderNumber]/route.ts' \
  'src/app/api/orders/[orderNumber]/cancel/route.ts' \
  scripts/audit-checkout-api.ts \
  scripts/setup-checkout-api.sh
do
  test -f "$file"
done

if git status --porcelain |
  grep -E \
    'prisma/schema\.prisma|prisma/migrations/'
then
  echo "Phase 2G-C must not change Prisma schema or migrations."
  exit 1
fi

echo "PASS: Checkout and order API files exist."
echo "PASS: No Prisma schema or migration change is present."

npm pkg set \
  "scripts.db:audit:checkout-api=node --env-file=.env --conditions=react-server --import tsx scripts/audit-checkout-api.ts"

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
echo "=== RUN CHECKOUT API AUDIT ==="

if npm run db:audit:checkout-api \
  2>&1 |
  tee -a "$DETAIL_LOG"
then
  echo "PASS: CHECKOUT API AUDIT"
else
  echo "FAIL: CHECKOUT API AUDIT"
  echo
  echo "Next.js server log:"
  tail -n 160 \
    /tmp/sorvyra-phase-2g-c-next-server.log \
    2>/dev/null \
    || true
  exit 1
fi

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
echo "=== VERIFY AUDIT CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TSCLEAN'
import {
  prisma,
} from "./src/lib/prisma";

const users =
  await prisma.user.count({
    where: {
      email: {
        contains:
          "checkout-api-",
        endsWith:
          "@example.test",
      },
    },
  });

const products =
  await prisma.product.count({
    where: {
      name: {
        contains:
          "Temporary checkout API product",
      },
    },
  });

const orders =
  await prisma.order.count({
    where: {
      customerEmail: {
        contains:
          "checkout-api-",
        endsWith:
          "@example.test",
      },
    },
  });

if (
  users !== 0 ||
  products !== 0 ||
  orders !== 0
) {
  throw new Error(
    [
      `${users} temporary user(s) remain.`,
      `${products} temporary product(s) remain.`,
      `${orders} temporary order(s) remain.`,
    ].join(" "),
  );
}

console.log(
  "PASS: No temporary checkout API records remain.",
);

await prisma.$disconnect();
TSCLEAN

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
        "Phase 2G-C unexpectedly changed the migration set.\n"
        f"Tracked: {sorted(tracked)}\n"
        f"Current: {sorted(current)}"
    )

print(
    "PASS: Phase 2G-C created no Prisma migration."
)
PY

echo
echo "=== VERIFY NO TEMPORARY SERVER REMAINS ==="

if ps -ef |
  grep -E \
    '[n]ode_modules/next/dist/bin/next start' \
  >/tmp/sorvyra-phase-2g-c-server-check.txt
then
  echo "A temporary Next.js server remains:"
  cat \
    /tmp/sorvyra-phase-2g-c-server-check.txt
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
echo "PHASE 2G-C AUTHENTICATED CHECKOUT AND ORDER API PASSED"
