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
| `PAYSTACK_SECRET_KEY` | Server bearer credential for Paystack transaction initialization | When `paystack` is selected |
| `FLUTTERWAVE_PUBLIC_KEY` | Reserved for future client-side Flutterwave features | No for hosted server initialization |
| `FLUTTERWAVE_SECRET_KEY` | Server bearer credential for Flutterwave Standard initialization | When `flutterwave` is selected |
| `FLUTTERWAVE_ENCRYPTION_KEY` | Reserved for future operations that explicitly require payload encryption | No for hosted server initialization |
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
   ```

The adapter audit uses mocked HTTP calls and never contacts
Paystack or Flutterwave.

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

The following provider webhook endpoints are reserved for
the next payment milestone and are **not implemented yet**:

```text
https://shop.sorvyra.com/api/payments/webhooks/paystack
https://shop.sorvyra.com/api/payments/webhooks/flutterwave
```

Do not configure production webhooks to those paths until
signature verification and provider-event normalization
are implemented and deployed. Keep test and live provider
credentials in separate Railway environments, and never
place either credential set in Git, documentation, logs,
fixtures, or audit scripts.
