# SORVYRA authentication delivery

SORVYRA STORE keeps customer authentication storefront-scoped while
using one provider-neutral message-delivery contract. Registration,
verification resends and password recovery create their tokens and
challenges on the server. Provider adapters receive only the message
details required to deliver those server-generated values.

## Supported configuration

Authentication delivery is disabled by default:

```text
AUTH_DELIVERY_PROVIDER=disabled
```

The implemented live adapter combines Resend for transactional email
and Twilio Programmable Messaging for SMS:

```text
AUTH_DELIVERY_PROVIDER=resend-twilio
```

There is no automatic fallback to another provider. An unknown
provider, missing credential, invalid sender configuration or invalid
timeout fails closed.

## Required variables

The combined provider requires:

```text
APP_ORIGIN=https://<staging-domain>
AUTH_DELIVERY_PROVIDER=resend-twilio
AUTH_DELIVERY_TIMEOUT_MS=8000

AUTH_EMAIL_FROM=SORVYRA STORE <accounts@<verified-email-domain>>
RESEND_API_KEY=<sealed-resend-sending-key>

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
- A successful provider request means the message was accepted for
  delivery. It does not prove that the recipient received or opened it.
- Email verification links point to the selected storefront's
  `/account/verify` page.
- Phone messages contain the server-generated code and a storefront
  verification link carrying only the challenge identifier.
- Password-reset links point to the selected storefront's
  `/account/reset-password` page.
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

Keep the provider disabled until both sandbox accounts and approved
senders are ready. In Railway staging:

1. Use the Railway staging origin for `APP_ORIGIN`.
2. Add Resend and Twilio credentials as sealed variables.
3. Use a Resend testing or verified staging domain.
4. Use a Twilio trial-approved recipient or an approved staging sender.
5. Configure exactly one Twilio sender variable.
6. Change `AUTH_DELIVERY_PROVIDER` to `resend-twilio`.
7. Redeploy and create a temporary storefront account.
8. Confirm the email link and SMS challenge both activate only that
   storefront account.
9. Confirm password recovery sends a single-use storefront-specific
   link.
10. Remove the temporary account and return the provider to `disabled`
    if staging delivery should not remain available.

Do not use live customer lists for staging tests. Twilio trial mode may
require the recipient number to be verified in the Twilio console.

## Local and automated tests

Run the deterministic adapter audit:

```text
npm run audit:auth-delivery-adapters
```

The audit mocks all provider HTTP requests. It covers disabled-default
behaviour, provider selection, incomplete configuration, normalized
Resend and Twilio success responses, storefront links, Resend
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
- confirm the production Twilio sender is permitted in every customer
  region;
- use production API keys stored only in Railway;
- set `APP_ORIGIN=https://shop.sorvyra.com`;
- exercise registration, verification resend and password recovery
  end to end; and
- keep all real keys out of source files, `.env.example`, fixtures,
  audit output and documentation.

Enabling authentication delivery does not authorize a production
deployment by itself.
