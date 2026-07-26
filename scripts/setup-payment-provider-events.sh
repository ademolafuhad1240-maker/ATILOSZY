#!/usr/bin/env bash

set -Eeuo pipefail

DETAIL_LOG="/tmp/sorvyra-phase-2h-a-details.log"
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

echo "=== VERIFY PHASE 2H-A FILES ==="

test "$(git branch --show-current)" = \
  "feat/commerce-foundation"

test -f \
  prisma/schema.prisma

test -f \
  scripts/audit-payment-provider-events.ts

test -f \
  scripts/setup-payment-provider-events.sh

python - <<'PY'
from pathlib import Path
import re

schema = Path(
    "prisma/schema.prisma"
).read_text(
    encoding="utf-8",
)

required = [
    "enum PaymentProviderEventStatus",
    "model PaymentProviderEvent",
    "paymentProviderEvents",
    "providerEvents",
    "@@unique([provider, providerEventId])",
    '@@map("payment_provider_events")',
]

for value in required:
    if value not in schema:
        raise RuntimeError(
            f"Payment-provider event schema is missing: {value}"
        )

enum_match = re.search(
    r"enum PaymentProviderEventStatus\s*\{(.*?)\}",
    schema,
    re.DOTALL,
)

if not enum_match:
    raise RuntimeError(
        "PaymentProviderEventStatus enum could not be read."
    )

enum_body = enum_match.group(1)

for status in [
    "RECEIVED",
    "PROCESSING",
    "PROCESSED",
    "IGNORED",
    "FAILED",
]:
    if status not in enum_body:
        raise RuntimeError(
            f"Provider-event status is missing: {status}"
        )

print(
    "PASS: Provider-event enum, model and relations exist."
)
PY

npm pkg set \
  "scripts.db:audit:payment-events=node --env-file=.env --conditions=react-server --import tsx scripts/audit-payment-provider-events.ts"

run_quiet \
  "FORMAT PRISMA SCHEMA" \
  npx prisma format

run_quiet \
  "VALIDATE PRISMA SCHEMA" \
  npm run db:validate

echo
echo "=== CREATE OR REUSE PHASE 2H-A MIGRATION ==="

BASELINE_COUNT="$(
  git ls-files \
    'prisma/migrations/*/migration.sql' |
    wc -l |
    tr -d ' '
)"

EVENT_MIGRATIONS="$(
  grep -Rl \
    'CREATE TYPE "PaymentProviderEventStatus"' \
    prisma/migrations/*/migration.sql \
    2>/dev/null \
    || true
)"

if [ -z "$EVENT_MIGRATIONS" ]; then
  BEFORE_COUNT="$(
    find prisma/migrations \
      -mindepth 2 \
      -maxdepth 2 \
      -name migration.sql |
      wc -l |
      tr -d ' '
  )"

  run_quiet \
    "CREATE PAYMENT EVENT MIGRATION" \
    npx prisma migrate dev \
      --name payment_provider_event_foundation

  AFTER_COUNT="$(
    find prisma/migrations \
      -mindepth 2 \
      -maxdepth 2 \
      -name migration.sql |
      wc -l |
      tr -d ' '
  )"

  if [ "$AFTER_COUNT" -ne "$((BEFORE_COUNT + 1))" ]; then
    echo "Expected exactly one new migration."
    echo "Before: $BEFORE_COUNT"
    echo "After: $AFTER_COUNT"
    exit 1
  fi
else
  echo "PASS: Payment-provider event migration already exists."

  run_quiet \
    "APPLY EXISTING PAYMENT EVENT MIGRATION" \
    npx prisma migrate dev
fi

run_quiet \
  "GENERATE PRISMA CLIENT" \
  npx prisma generate

echo
echo "=== VERIFY EXACT MIGRATION SET ==="

python - "$BASELINE_COUNT" <<'PY'
from pathlib import Path
import sys
import subprocess

baseline = int(
    sys.argv[1]
)

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

new = current - tracked

if len(tracked) != baseline:
    raise RuntimeError(
        "Tracked migration baseline changed unexpectedly."
    )

if len(new) != 1:
    raise RuntimeError(
        "Phase 2H-A must create exactly one migration.\n"
        f"New migrations: {sorted(new)}"
    )

migration = Path(
    next(iter(new))
)

sql = migration.read_text(
    encoding="utf-8",
)

required = [
    'CREATE TYPE "PaymentProviderEventStatus"',
    'CREATE TABLE "payment_provider_events"',
    '"providerEventId" VARCHAR(191) NOT NULL',
    '"payloadHash" VARCHAR(128) NOT NULL',
    '"signatureVerified" BOOLEAN NOT NULL DEFAULT false',
    '"payment_provider_events_provider_providerEventId_key"',
]

for value in required:
    if value not in sql:
        raise RuntimeError(
            f"Migration is missing: {value}"
        )

for forbidden in [
    'DROP TABLE',
    'DROP TYPE',
    'ALTER TABLE "orders"',
    'ALTER TABLE "order_payments"',
    'ALTER TABLE "storefronts"',
]:
    if forbidden in sql:
        raise RuntimeError(
            f"Migration unexpectedly changes an existing structure: {forbidden}"
        )

print(
    f"PASS: Exactly one provider-event migration exists: {migration}"
)
print(
    "PASS: Migration creates only the provider-event ledger and its constraints."
)
PY

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
echo "=== RUN PROVIDER EVENT FOUNDATION AUDIT ==="

if npm run db:audit:payment-events \
  2>&1 |
  tee -a "$DETAIL_LOG"
then
  echo "PASS: PAYMENT EVENT FOUNDATION AUDIT"
else
  echo "FAIL: PAYMENT EVENT FOUNDATION AUDIT"
  exit 1
fi

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
echo "=== VERIFY AUDIT CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TSCLEAN'
import {
  prisma,
} from "./src/lib/prisma";

const remaining =
  await prisma.paymentProviderEvent.count({
    where: {
      provider: {
        startsWith:
          "audit-provider-",
      },
    },
  });

if (remaining !== 0) {
  throw new Error(
    `${remaining} temporary provider-event record(s) remain.`,
  );
}

console.log(
  "PASS: No temporary provider-event records remain.",
);

await prisma.$disconnect();
TSCLEAN

echo
echo "=== VERIFY NO PAYMENT PROVIDER IMPLEMENTATION ==="

python - <<'PY'
from pathlib import Path

paths = [
    Path(
        "prisma/schema.prisma"
    ),
    Path(
        "scripts/audit-payment-provider-events.ts"
    ),
]

content = "\n".join(
    path.read_text(
        encoding="utf-8",
    )
    for path in paths
)

for forbidden in [
    "Flutterwave",
    "Paystack",
    "Stripe",
    "PayPal",
    "secretKey",
    "webhookSecret",
    "paymentIntent",
    "checkoutSession",
]:
    if forbidden in content:
        raise RuntimeError(
            f"Provider-specific implementation detected: {forbidden}"
        )

payment_routes = [
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

if payment_routes:
    raise RuntimeError(
        "Phase 2H-A must not add payment or webhook routes:\n" +
        "\n".join(
            str(path)
            for path in payment_routes
        )
    )

print(
    "PASS: No provider SDK, credential, payment route or webhook route was added."
)
PY

echo
echo "=== VERIFY GENERATED CLIENT IS NOT TRACKED ==="

if git status --porcelain |
  grep -E \
    'src/generated/prisma|\.env'
then
  echo "Generated Prisma files or environment files unexpectedly appear in Git status."
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
echo "PHASE 2H-A PROVIDER-NEUTRAL PAYMENT EVENT FOUNDATION PASSED"
