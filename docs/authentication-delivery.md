# SORVYRA authentication delivery

SORVYRA STORE uses one platform customer account across every active
storefront while keeping each storefront session, cart, checkout,
order and currency boundary isolated. Registration,
verification resends and password recovery create their tokens and
challenges on the server. Provider adapters receive only the message
details required to deliver those server-generated values.

## Supported configuration

Authentication delivery is disabled by default:

```text
AUTH_DELIVERY_PROVIDER=disabled
```

The recommended live adapter uses Resend for transactional email:

```text
AUTH_DELIVERY_PROVIDER=resend
```

Customer account activation requires verified email. A phone number is
still collected for delivery contact, but an SMS code is not required
and `phoneVerifiedAt` remains empty unless a real phone challenge is
completed.

An optional combined adapter retains Twilio Programmable Messaging for
future phone verification:

```text
AUTH_DELIVERY_PROVIDER=resend-twilio
```

There is no automatic fallback to another provider. An unknown
provider, missing credential, invalid sender configuration or invalid
timeout fails closed.

## Required variables

The Resend-only provider requires:

```text
APP_ORIGIN=https://<staging-domain>
AUTH_DELIVERY_PROVIDER=resend
AUTH_DELIVERY_TIMEOUT_MS=8000

AUTH_EMAIL_FROM=SORVYRA STORE <accounts@<verified-email-domain>>
RESEND_API_KEY=<sealed-resend-sending-key>
```

The optional combined provider additionally requires:

```text
AUTH_DELIVERY_PROVIDER=resend-twilio
TWILIO_ACCOUNT_SID=<sealed-account-sid>
TWILIO_API_KEY=<sealed-api-key-sid>
TWILIO_API_KEY_SECRET=<sealed-api-key-secret>
```

Configure exactly one Twilio sender:

```text
AUTH_SMS_SENDER=<approved-sender>
```

or:

```text
TWILIO_MESSAGING_SERVICE_SID=<approved-messaging-service-sid>
```

`TWILIO_API_KEY` and `TWILIO_API_KEY_SECRET` are used for HTTP Basic
authentication. The account SID remains part of the Twilio Messages
resource path. Prefer a restricted production API key rather than the
Twilio account auth token.

`AUTH_EMAIL_FROM` must use a domain verified in Resend before messages
can be sent to ordinary customer addresses. A Resend key restricted to
sending email is sufficient.

## Delivery behaviour

- Registration requires a fully configured provider before any
  customer record is created by the public API.
- One email may register only one SORVYRA STORE customer account.
- After verification, one successful sign-in establishes a separate
  protected session for every active storefront. Those sessions map
  to storefront-local customer memberships; they do not combine carts
  or orders.
- Existing storefront customer records are linked to a platform
  customer identity by an additive migration. The migration does not
  delete or rewrite carts, orders, payments or inventory.
- A successful provider request means the message was accepted for
  delivery. It does not prove that the recipient received or opened it.
- Email verification links point to the selected storefront's
  `/account/verify` page.
- Email verification activates a pending account without writing a
  false phone-verification timestamp.
- Phone messages are optional. When the combined provider is selected,
  they contain the server-generated code and a storefront verification
  link carrying only the challenge identifier.
- Password-reset links use one of the account's existing storefront
  memberships and update the password across every linked membership.
- Password reset revokes active sessions across all storefronts.
- Resend requests use the verification database record as their
  idempotency identity.
- Provider timeouts, network failures, HTTP rejections and malformed
  responses return only the generic authentication-delivery error.
  Provider credentials and raw provider responses are never returned
  to the browser.
- Registration and recovery tokens remain single-use server records.
  Delivery-provider acceptance is never treated as account
  verification.

## Staging setup

Keep the provider disabled until the Resend domain and sending key are
ready. In Railway staging:

1. Use the Railway staging origin for `APP_ORIGIN`.
2. Add the Resend credential as a sealed variable.
3. Use a verified Resend staging domain.
4. Change `AUTH_DELIVERY_PROVIDER` to `resend`.
5. Redeploy and create a temporary SORVYRA STORE account from one
   storefront.
6. Confirm the email link activates the platform customer account.
7. Confirm the stored phone remains unverified.
8. Sign in once and confirm account access works across multiple
   storefronts while each cart remains independent.
9. Confirm password recovery sends a single-use link and invalidates
   sessions across storefronts.
10. Remove the temporary account and return the provider to `disabled`
    if staging delivery should not remain available.

Do not use live customer lists for staging tests. If optional Twilio
delivery is tested later, use an approved sender and recipient that
meet the destination country's rules.

## Local and automated tests

Run the deterministic adapter audit:

```text
npm run audit:auth-delivery-adapters
npm run audit:platform-customer-access
```

The audit mocks all provider HTTP requests. It covers disabled-default
behaviour, provider selection, incomplete configuration, normalized
Resend-only and combined-provider selection, normalized Resend and
Twilio success responses, storefront links, Resend
idempotency, HTTP rejection, malformed responses, network failures,
timeouts and credential-safe errors. It never sends a live message.

Database-backed registration, resend and recovery behaviour remains
covered by:

```text
npm run db:audit:recovery
npm run db:audit:recovery-http
npm run db:audit:auth-api
```

## Production gate

Before enabling production delivery:

- connect and verify the production email-sending domain;
- if SMS is enabled later, confirm its sender is permitted in every
  customer region;
- use production API keys stored only in Railway;
- set `APP_ORIGIN=https://shop.sorvyra.com`;
- exercise registration, verification resend and password recovery
  end to end; and
- keep all real keys out of source files, `.env.example`, fixtures,
  audit output and documentation.

Enabling authentication delivery does not authorize a production
deployment by itself.
