# SORVYRA STORE payment initiation providers

## Architecture

Product-payment initiation remains provider-neutral.
The authenticated order-payment route resolves the
storefront session and order, then derives the amount,
currency, customer identity, merchant reference,
idempotency key, and storefront return URL on the server.
It passes that server-controlled request to the configured
provider contract.

Provider-specific HTTP behavior lives only in:

- `src/server/payments/providers/paystack.ts`
- `src/server/payments/providers/flutterwave.ts`
- shared provider HTTP and money helpers in the same folder

`src/server/payments/registry.ts` resolves the configured
adapter. API routes, checkout components, order services,
and payment-transition services do not contain Paystack or
Flutterwave request logic.

The provider result is normalized to a provider reference
and a redirect action. Only the redirect URL and safe
payment state are returned to the browser. Secret keys,
raw provider responses, access codes, provider metadata,
merchant references, and idempotency keys are not exposed.

An initialization response or redirect back to SORVYRA
STORE is not proof of payment. Orders remain in payment
processing until a later verified provider callback or
event passes the existing server-side reference, amount,
currency, and transition checks.

## Provider selection

`PAYMENT_INITIATION_PROVIDER` supports:

- `disabled` (the default)
- `paystack`
- `flutterwave`

An empty value also resolves to `disabled`. An unknown
provider, or a selected live provider without its secret
key, fails closed. The registry never falls back from a
misconfigured provider to another live provider.

Provider selection is global for this milestone. It remains
server configuration and cannot be selected by a customer
request or storefront component.

## Environment variables

The repository `.env.example` contains placeholders only.
Never commit test or live credentials.

| Variable | Purpose | Required |
| --- | --- | --- |
| `PAYMENT_INITIATION_PROVIDER` | Selects `disabled`, `paystack`, or `flutterwave` | Yes; defaults to `disabled` when absent |
| `PAYSTACK_PUBLIC_KEY` | Reserved for a future Paystack browser SDK if one is deliberately added | No for hosted server initialization |
| `PAYSTACK_SECRET_KEY` | Server bearer credential for Paystack initialization, webhook signatures, and transaction verification | When Paystack initiation or webhooks are enabled |
| `FLUTTERWAVE_PUBLIC_KEY` | Reserved for future client-side Flutterwave features | No for hosted server initialization |
| `FLUTTERWAVE_SECRET_KEY` | Server bearer credential for Flutterwave Standard initialization and transaction verification | When Flutterwave initiation or webhooks are enabled |
| `FLUTTERWAVE_ENCRYPTION_KEY` | Reserved for future operations that explicitly require payload encryption | No for hosted server initialization |
| `FLUTTERWAVE_WEBHOOK_SECRET_HASH` | Random webhook signing secret configured identically in the Flutterwave dashboard | When Flutterwave webhooks are enabled |
| `APP_ORIGIN` | Trusted application origin used to build the post-checkout return URL | Yes |

The hosted flows implemented here do not require the
Paystack or Flutterwave public key. Flutterwave Standard
also does not require the encryption key, so the adapter
does not use it unnecessarily.

## Provider behavior

Paystack initializes transactions through its server API
using secret-key bearer authentication. It accepts NGN,
converts the exact decimal order amount to minor units, and
uses the server-generated merchant reference as Paystack's
unique transaction reference. The selected order payment
method is mapped to a single supported Paystack channel.

Flutterwave initializes Flutterwave Standard hosted
checkout using secret-key bearer authentication. It sends
the server-generated merchant reference as `tx_ref` and
preserves the server-derived major-unit amount and
currency. NGN supports card, bank transfer, USSD, and
direct bank-account options. QAR is restricted to card in
the adapter; actual QAR availability still depends on the
merchant account and Flutterwave's current regional
capabilities. Provider rejection is returned as a safe
payment-provider failure and never changes the order to
paid.

Both adapters:

- use fixed official HTTPS API endpoints;
- apply a bounded server timeout;
- normalize HTTP rejection, malformed response, timeout,
  and network failure;
- discard raw error bodies;
- avoid logging credentials or sensitive payloads;
- preserve deterministic server references on repeated
  initialization attempts.

## Verified payment webhooks

The implemented webhook endpoints are:

```text
/api/payments/webhooks/paystack
/api/payments/webhooks/flutterwave
```

They are external provider endpoints, so they do not use
the storefront session or browser-origin checks. Instead,
they authenticate the exact raw request body before JSON
parsing:

- Paystack requires `x-paystack-signature`, verified as an
  HMAC-SHA512 digest with `PAYSTACK_SECRET_KEY`.
- Flutterwave requires `flutterwave-signature`, verified as
  an HMAC-SHA256 base64 digest with
  `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.

After signature verification, the webhook adapter retrieves
the transaction from the provider's server API using the
provider secret key. The signed event and verified
transaction must agree on transaction ID, merchant
reference, amount, currency, and final outcome before the
existing provider-neutral transition service is called.

Only safe normalized fields are stored in the provider
event ledger. Customer details, card data, authorization
objects, raw provider responses, and credentials are
discarded. Duplicate deliveries produce the same provider
event ID and raw-payload hash, allowing the existing
database uniqueness and conflict checks to enforce durable
idempotency.

Unsupported event types are acknowledged and ignored.
Invalid signatures are rejected before provider lookup or
database work. Verification outages return a retryable
non-200 response and cannot mark an order paid.

## Authenticated payment reconciliation

The authenticated reconciliation endpoint is:

```text
POST /api/orders/{orderNumber}/payment/reconcile
```

It accepts only the storefront code needed to resolve the
authenticated session. Provider identity, provider
reference, amount, currency, transaction identifier,
idempotency identity, and desired status remain
server-controlled.

Reconciliation resolves the provider stored on the payment
and uses the same Paystack or Flutterwave server
verification layer used by verified webhooks. Paystack is
queried by its stored transaction reference. Flutterwave is
queried by its stored merchant `tx_ref`. A final result must
match the stored provider, reference, exact amount, and
currency before it enters the existing payment transition
service.

Each attempt is recorded in the provider-event ledger. A
database-backed 60-second cooldown prevents tight
customer-driven polling across multiple application
instances. Pending results are visible in the ledger but do
not change payment state. Provider/network errors are stored
as safe failure codes and never include credentials or raw
responses. Stable final-event identity preserves transition
idempotency if a result is reconciled more than once.

## Local test-mode setup

1. Run `npm ci`.
2. Create a local `.env` from `.env.example`.
3. Keep `APP_ORIGIN=http://localhost:3000`.
4. Start the local PostgreSQL service or point
   `DATABASE_URL` and `DIRECT_URL` at a disposable
   development database.
5. Keep `PAYMENT_INITIATION_PROVIDER=disabled` for the
   default local workflow.
6. To manually exercise one hosted provider, select it and
   set only that provider's test credentials in the local
   `.env`. Never use live credentials in local development.
7. Run:

   ```text
   npm run db:audit:payment-provider-adapters
   npm run db:audit:payment-initiation-api
   npm run db:audit:payment-webhooks
   npm run db:audit:payment-reconciliation
   npm run audit:railway-readiness
   ```

The adapter, webhook, and reconciliation audits use mocked
HTTP calls and never contact Paystack or Flutterwave. Use
separate test credentials and a test-only Flutterwave
webhook secret hash when manually exercising dashboard
delivery.

## Railway readiness

Railway should provide `DATABASE_URL` from Railway
PostgreSQL and set the application variables through the
service's Variables settings. Set `DIRECT_URL` to the
production-safe direct PostgreSQL connection required by
the Prisma workflow. Run `npm run db:deploy` for
production migrations; do not run development migrations
against production.

Next.js reads Railway's provided `PORT` through the
existing `next start` command. No production Docker
dependency, hardcoded deployment URL, or Render-specific
configuration is required.

For the intended production domain, set:

```text
APP_ORIGIN=https://shop.sorvyra.com
```

Provider return URLs are generated from that origin and the
authenticated storefront order page. A return URL only
restores the customer journey; it does not confirm payment.

After this code is deployed, configure the provider
dashboards with:

```text
https://shop.sorvyra.com/api/payments/webhooks/paystack
https://shop.sorvyra.com/api/payments/webhooks/flutterwave
```

The Flutterwave dashboard secret hash must exactly match
`FLUTTERWAVE_WEBHOOK_SECRET_HASH` in the corresponding
Railway environment. Configure test dashboards only
against a test deployment and test credentials; configure
live dashboard delivery only after production deployment
is explicitly approved.

Keep test and live provider credentials in separate Railway
environments, and never place either credential set in Git,
documentation, logs, fixtures, or audit scripts.

The complete staging connection checklist and production
gate are documented in `docs/railway-readiness.md`.
