# SORVYRA STORE staff order operations

## Architecture

Staff order operations reuse the verified storefront
session foundation, but a customer session alone never
grants operational access. The authenticated user must
also have an active `StorefrontStaffMembership` for the
same storefront.

Membership is deliberately separate from the public
customer profile:

- public registration cannot create or update it;
- `MANAGER` and `FULFILMENT` roles may perform allowed
  fulfilment transitions;
- `VIEWER` is read-only;
- suspended or revoked memberships fail closed; and
- one storefront membership cannot read or change another
  storefront's orders.

The first milestone supports a storefront-bound membership.
A future parent-platform administration phase can add
explicit multi-store access without weakening this
boundary.

## Order queue and transitions

Each storefront has one shared operations page:

```text
/ng/atiloszy/staff/orders
/ng/zee-beauty-fashion/staff/orders
/ng/denald/staff/orders
/qa/zee-comfort-hub/staff/orders
```

The page calls provider-neutral staff APIs and never accepts
authoritative order states, payment states, staff identity,
inventory values, or audit fields from the browser.

Only verified product-paid orders may enter fulfilment. The
server exposes the next allowed action from a monotonic
state machine:

```text
PAID
  -> CONFIRMED
  -> PROCESSING / PREPARING
  -> READY_FOR_PICKUP | OUT_FOR_DELIVERY | INSTALLATION_IN_PROGRESS
  -> COMPLETED
```

Delivery-and-installation orders move from
`OUT_FOR_DELIVERY` to `INSTALLATION_IN_PROGRESS` before
completion. Reversal, skipping and repeated completion are
rejected.

All current storefronts quote delivery fees after product
payment. A delivery order therefore remains on hold until
the delivery fee has been verified paid. This milestone
does not invent a free-delivery assumption or bypass the
future delivery-quote workflow.

## Inventory and audit history

Every accepted transition creates an
`OrderFulfilmentEvent` with:

- the storefront and order identity;
- the acting membership, email snapshot and role;
- the action;
- previous and resulting order states;
- previous and resulting fulfilment states; and
- an optional bounded note.

Completing a tracked order atomically:

1. decrements reserved stock;
2. decrements stock on hand;
3. records a `SALE` stock movement referencing the order;
4. marks an active pickup reservation collected where one
   exists; and
5. records the final fulfilment event.

Serializable transactions, order-row locking and strict
state checks prevent duplicate stock settlement.

## Provisioning a staff member

There is no public staff-signup endpoint. Create and verify
the storefront account normally, then run the protected
one-off command from an environment that can reach the
database.

Temporarily set:

```text
STAFF_PROVISIONING_ENABLED=true
```

Then run:

```text
npm run staff:provision -- \
  --storefront ATI \
  --email staff-account@example.test \
  --role MANAGER \
  --confirm ATI:staff-account@example.test:MANAGER
```

On Windows PowerShell, place the command on one line.
Supported roles are `MANAGER`, `FULFILMENT`, and `VIEWER`.
The exact confirmation value prevents an accidental
cross-store grant.

Immediately remove or reset
`STAFF_PROVISIONING_ENABLED=false` after the command. Never
commit a real staff email, password, session token, or
database credential. Provisioning never creates a password;
it grants membership only to an existing verified active
account.

## Railway

The additive migration creates staff memberships,
fulfilment events, enums, indexes, foreign keys, and
database checks. Railway's existing pre-deploy
`npm run db:deploy` command applies it before the new
application revision becomes active.

Keep `STAFF_PROVISIONING_ENABLED=false` or omit it during
normal staging and production operation. Enable it only for
a deliberate one-off Railway command and disable it again
immediately.

No new public endpoint, deployment URL, provider credential,
or production secret is required.

## Audits

Run:

```text
npm run db:validate
npm run db:generate
npm run audit:staff-order-operations
npm run db:audit:staff-order-services
npm run lint
npm run build
```

The service audit requires a migrated PostgreSQL database
with the standard storefront seed data. It creates and
removes temporary accounts, products, memberships, orders,
events and inventory movements. It does not call a live
payment provider.
