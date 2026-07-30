# SORVYRA staff governance

SORVYRA STORE uses one governance layer for every storefront.
It does not create a separate commerce backend or a separate
password system for each brand.

## Access model

### SORVYRA platform administrator

A platform administrator uses one SORVYRA platform login. The
permission is global and the owner never selects or signs in as a
storefront. The initial account should use the `OWNER` role.

The credential is initially linked to an existing verified account
so the established password hashing, lockout and session controls
can be reused. That underlying bootstrap link is resolved only by
the server and is not a storefront scope or browser input.

Platform administrators can:

- review manager applications for every storefront;
- approve or reject a pending application;
- suspend, reactivate or revoke an approved manager;
- see the current manager directory across all storefronts.

Platform administrator access cannot be requested through public
registration or a browser API. It is provisioned with the protected
one-off command described below.

### Storefront manager

A manager signs in with the verified account registered in the
storefront they manage. Approval creates an active `MANAGER`
membership for that storefront only.

Managers can:

- open their storefront order and fulfilment queue;
- grant `FULFILMENT` or `VIEWER` access to another verified account
  in the same storefront;
- change delegated staff roles;
- suspend, reactivate or revoke delegated staff access.

Managers cannot:

- approve their own application;
- grant or modify manager access;
- access another storefront;
- grant access to an account registered only in another storefront;
- create a SORVYRA platform administrator;
- control payment credentials, currency or provider configuration.

### Storefront staff

Delegated staff retain the existing order-operation permissions:

- `FULFILMENT` can process verified paid orders.
- `VIEWER` can inspect the queue but cannot transition orders.

## Pages

The central pages are:

```text
/manager/login
/manager/apply
/manager
/admin/login
/admin
```

Managers select the storefront they manage and use its verified
account. Administrators instead authenticate through the dedicated
SORVYRA platform endpoint with email and password only. The server
resolves the active platform administrator, creates a separate
HTTP-only platform session cookie and never accepts a storefront
from the administrator browser.

The manager portal links to the existing storefront-specific order
queues after the server confirms an active manager membership.

## Manager application lifecycle

1. The applicant creates and verifies an account in the intended
   storefront.
2. The applicant signs in at `/manager/login`.
3. The applicant submits a 40-to-2,000-character statement.
4. The application is stored as `PENDING`.
5. A SORVYRA administrator reviews it in `/admin`.
6. Approval atomically creates or reactivates the storefront
   `MANAGER` membership and marks the application `APPROVED`.
7. Rejection records the decision without granting staff access.
8. An applicant may withdraw only a pending application.

The database permits only one pending application for the same
account and storefront. Every application, review and staff-access
transition creates an immutable governance audit event.

## Initial owner provisioning

First create and fully verify the storefront account that will be
used by the SORVYRA owner. Keep provisioning disabled during normal
runtime:

```text
PLATFORM_ADMIN_PROVISIONING_ENABLED=false
```

For one protected command, set it to `true` in the command
environment and provide an exact confirmation:

```text
npm run platform-admin:provision -- \
  --storefront ATI \
  --email owner@example.test \
  --role OWNER \
  --confirm ATI:owner@example.test:OWNER
```

Use the actual verified account email only at execution time. Never
put it in source, committed documentation, fixtures or logs.
Immediately return `PLATFORM_ADMIN_PROVISIONING_ENABLED` to `false`
or remove it after provisioning.

In a Railway service console, the deployment does not contain a
`.env` file. Run the underlying command with Railway's injected
environment instead:

```text
PLATFORM_ADMIN_PROVISIONING_ENABLED=true \
node --conditions=react-server --import tsx \
scripts/provision-platform-administrator.ts \
--storefront ATI \
--email owner@example.test \
--role OWNER \
--confirm ATI:owner@example.test:OWNER
```

The provisioning gate should not be stored as `true` in Railway.
The `--storefront` argument is used only to locate the exact account
during this protected bootstrap command. It is not requested during
administrator login and does not limit the administrator role.

## Verification

Static security and page checks:

```text
npm run audit:staff-governance
npm run lint
npm run build
```

Database-backed lifecycle audit:

```text
npm run db:audit:staff-governance-services
```

The database audit creates temporary verified accounts,
applications, memberships and governance events, exercises the
complete lifecycle, and removes the temporary records.

## Future extensions

Recommended future additions are mandatory administrator two-factor
authentication, email notifications for application decisions and
staff invitations. These are not prerequisites for the current
authenticated, manually reviewed workflow.
