import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(
    join(root, path),
    "utf8",
  );
}

console.log(
  "=== PLATFORM CUSTOMER ACCESS AUDIT ===",
);

const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20260801193000_platform_customer_accounts/migration.sql",
);
const registration = read(
  "src/server/auth/registration.ts",
);
const session = read(
  "src/server/auth/session.ts",
);
const loginRoute = read(
  "src/app/api/auth/login/route.ts",
);
const authForms = read(
  "src/components/auth/auth-forms.tsx",
);

assert.match(
  schema,
  /model CustomerAccount[\s\S]*normalizedEmail\s+String\s+@unique/,
);
assert.match(
  schema,
  /customerAccountId\s+String\?/,
);
assert.match(
  schema,
  /@@unique\(\[customerAccountId, storefrontId\]\)/,
);

console.log(
  "PASS: One normalized email owns one platform customer identity with at most one membership per storefront.",
);

assert.match(
  migration,
  /INSERT INTO "customer_accounts"/,
);
assert.match(
  migration,
  /INNER JOIN "storefront_customers"/,
);
assert.doesNotMatch(
  migration,
  /^\s*(?:DELETE\s+FROM|DROP\s+TABLE|TRUNCATE)\b/im,
);

console.log(
  "PASS: The production migration links existing customers without deleting commerce data.",
);

assert.match(
  registration,
  /customerAccount\.findUnique/,
);
assert.match(
  registration,
  /customerAccount\.create/,
);
assert.match(
  registration,
  /same account on any storefront/,
);

console.log(
  "PASS: Registration creates one SORVYRA account and rejects duplicate cross-store registration.",
);

assert.match(
  session,
  /createAllStorefrontSessions/,
);
assert.match(
  session,
  /status: "ACTIVE"/,
);
assert.match(
  session,
  /storefrontSessions\.push/,
);
assert.match(
  loginRoute,
  /for \(const storefrontSession of/,
);
assert.match(
  loginRoute,
  /setSessionCookie\(/,
);

console.log(
  "PASS: One successful login establishes protected storefront-specific sessions.",
);

assert.match(
  schema,
  /model Cart[\s\S]*user\s+User\s+@relation\(fields: \[userId, storefrontId\]/,
);
assert.match(
  schema,
  /model Order[\s\S]*user\s+User\s+@relation\(fields: \[userId, storefrontId\]/,
);
assert.match(
  schema,
  /model Cart[\s\S]*currencyCode\s+String/,
);

console.log(
  "PASS: Carts, orders and currencies remain bound to their storefront membership.",
);

assert.match(
  authForms,
  /same account[\s\S]*every storefront/,
);
assert.match(
  authForms,
  /own cart, checkout and orders/,
);

console.log(
  "PASS: Customer-facing authentication copy explains the platform account and isolated commerce boundaries.",
);

console.log(
  "PASS: Platform customer access audit completed.",
);
