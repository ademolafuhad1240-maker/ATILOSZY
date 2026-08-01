# SORVYRA STORE Railway readiness

## Current connection gate

The repository is ready to connect to a **staging**
Railway project after the Phase 2H-F commit is pushed.
Connecting the repository is not approval to deploy the
production environment or attach `shop.sorvyra.com`.

The Railway service must initially deploy from
`feat/commerce-foundation`. The default `main` branch does
not yet contain the commerce platform and must not be used
as the deployment source.

Keep payment initiation, customer registration, and
verification-message delivery disabled during the first
staging deployment. Do not add live Paystack or
Flutterwave credentials until the staging database,
healthcheck, authentication, checkout, and payment audits
have passed.

## Configuration committed with the application

`railway.json` defines:

- Railway Railpack as the builder;
- `npm run build` as the production build;
- `npm run db:deploy` as the pre-deploy migration command;
- `npm run start` as the web-service command;
- `/api/health/database` as the deployment healthcheck;
- a 300-second healthcheck window; and
- an on-failure restart policy with three retries.

The pre-deploy command uses committed Prisma migrations.
It never runs `prisma migrate dev`, resets a database, or
seeds production data.

`package.json` restricts deployment to Node.js versions
supported by Prisma 7. Railway provides `PORT`; the existing
Next.js start command reads it without a hardcoded port.

## First staging connection

1. Create a new Railway project and a staging environment.
2. Add a Railway PostgreSQL service in the same project.
3. Connect the GitHub repository
   `ademolafuhad1240-maker/ATILOSZY`.
4. Select `feat/commerce-foundation` as the service branch.
5. Add a Railway-generated public domain for the web
   service.
6. Configure the variables below before approving the
   staged deployment.
7. Review the staged Railway changes and deploy the staging
   environment.
8. Confirm the deployment healthcheck returns HTTP 200.
9. Exercise storefront catalogue, customer login, cart,
   checkout, order ownership, and payment-disabled flows.
10. Run database-backed payment audits against the staging
    database before enabling a test payment provider.

The approved manager catalogue at `/manager/catalogue` supports
multiple size/colour variants with separate SKU, selling unit, pieces
per unit, historical quantity-price breaks, price and stock, plus durable
multi-photo uploads through the optional Cloudinary adapter. The
selling-unit migration is additive and runs through the existing
`npm run db:deploy` pre-deploy command. It needs no new Railway variable.
The provider remains disabled by default. Run
`npm run audit:catalog-media` and
`npm run db:audit:catalog-management` before enabling it. Uploaded
product photos never use Railway's service filesystem.

## Required initial variables

Use Railway reference variables instead of copying database
credentials:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=${{Postgres.DATABASE_URL}}
APP_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}
AUTH_TOKEN_SECRET=<at-least-32-random-characters>
AUTH_TRUSTED_ORIGINS=
AUTH_REGISTRATION_API_ENABLED=false
AUTH_DELIVERY_PROVIDER=disabled
AUTH_DELIVERY_TIMEOUT_MS=8000
STAFF_PROVISIONING_ENABLED=false
PLATFORM_ADMIN_PROVISIONING_ENABLED=false
PAYMENT_INITIATION_PROVIDER=disabled
CATALOG_MEDIA_PROVIDER=disabled
CATALOG_MEDIA_UPLOAD_TIMEOUT_MS=15000
```

If the Railway PostgreSQL service has a different service
name, select its `DATABASE_URL` through Railway's reference
variable picker rather than typing the example literally.

Generate `AUTH_TOKEN_SECRET` outside the repository and save
it as a sealed Railway variable. Never paste it into source,
documentation, build logs, or GitHub.

Staff order pages remain inaccessible until an existing
verified storefront account receives an explicit staff
membership. Keep `STAFF_PROVISIONING_ENABLED=false` during
normal deployment. The protected one-off process is
documented in `docs/staff-order-operations.md`.

The SORVYRA owner portal remains inaccessible until one verified
account receives an explicit platform administrator membership.
The administrator then signs in through the dedicated SORVYRA
platform login without selecting a storefront. Keep
`PLATFORM_ADMIN_PROVISIONING_ENABLED=false` during normal
deployment. Provisioning, manager applications and storefront staff
controls are documented in `docs/staff-governance.md`.

## Staging product-photo uploads

Use a separate Cloudinary product environment for staging. Add the
following variables as sealed Railway values before changing the
provider from `disabled`:

```text
CATALOG_MEDIA_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=<staging-cloud-name>
CLOUDINARY_API_KEY=<staging-api-key>
CLOUDINARY_API_SECRET=<sealed-staging-api-secret>
CATALOG_MEDIA_UPLOAD_TIMEOUT_MS=15000
```

Do not configure `CLOUDINARY_URL` in the repository, reuse
production credentials in staging, or expose the API secret to the
browser. The application validates and optimizes images before its
authenticated server-side Cloudinary upload. Cloudinary has no
payment callback or webhook requirement for this upload flow.

Customer registration, verification resend and password recovery
remain closed while `AUTH_DELIVERY_PROVIDER=disabled`. The implemented
`resend` email adapter is the recommended low-cost configuration.
The optional `resend-twilio` adapter remains available for future SMS
verification. Sealed Railway variables and the staged enablement
procedure are documented in `docs/authentication-delivery.md`. Do not
enable public registration until email verification and password
recovery pass a staging smoke test.

## Test payment enablement gate

After the first staging checks pass, enable exactly one
provider with test credentials.

### Paystack test mode

```text
PAYMENT_INITIATION_PROVIDER=paystack
PAYSTACK_SECRET_KEY=<sealed-test-secret>
```

Configure the test webhook as:

```text
https://<staging-domain>/api/payments/webhooks/paystack
```

### Flutterwave test mode

```text
PAYMENT_INITIATION_PROVIDER=flutterwave
FLUTTERWAVE_SECRET_KEY=<sealed-test-secret>
FLUTTERWAVE_WEBHOOK_SECRET_HASH=<sealed-test-webhook-secret>
```

Configure the test webhook as:

```text
https://<staging-domain>/api/payments/webhooks/flutterwave
```

Do not configure both providers as automatic fallbacks.
The stored provider identity controls later verification
and reconciliation.

For the staging customer smoke test:

1. Sign in to the matching storefront account and prepare
   an unpaid order.
2. Open the private order page and use **Continue to secure
   payment** with the provider's documented test details.
3. Confirm the hosted page uses the expected test account
   and exact server-derived order total and currency.
4. Return to the order page and use **Check payment
   status** if the webhook has not already updated it.
5. Confirm that a browser redirect alone never changes the
   order to paid, a verified failure can be retried or
   cancelled, and a verified success cannot be cancelled.

## Production gate

Do not connect `shop.sorvyra.com`, use live provider keys,
or enable production auto-deploys until all of the following
are true:

- committed migrations have been applied successfully to a
  disposable staging database;
- database-backed payment event and transition audits pass;
- the Resend email authentication-delivery adapter passes mocked
  audits and registration, verification resend and password
  recovery pass end to end with staging credentials (Twilio SMS
  remains an optional later enhancement);
- Paystack and/or Flutterwave sandbox initiation, webhook,
  reconciliation, duplicate delivery, and failure scenarios
  pass end to end;
- Railway healthchecks and rollback behavior are observed;
- production database backup and recovery procedures are
  confirmed; and
- the user explicitly approves production deployment.

The intended production origin remains:

```text
APP_ORIGIN=https://shop.sorvyra.com
```

Only after the production deployment is approved and
healthy should provider dashboards be changed to:

```text
https://shop.sorvyra.com/api/payments/webhooks/paystack
https://shop.sorvyra.com/api/payments/webhooks/flutterwave
```
