# SORVYRA storefront catalogue management

SORVYRA STORE provides one reusable catalogue and inventory
backend for every storefront. An approved storefront manager can
manage only the storefront named by their active membership.

## Manager workflow

The manager opens:

```text
/manager/catalogue?storefrontCode=ATI
```

The same page supports `ZBF`, `DEN`, `ZCH`, and future configured
storefronts. The server verifies the signed-in account, active
`MANAGER` role, storefront status, and storefront code on every
read and write.

Managers can:

- create a draft or active product with one initial managed variant;
- set its name, descriptions, brand, category and storefront image;
- set regular, compare-at and internal cost prices;
- publish, hide, return to draft or archive a listing;
- configure featured status, per-order limits, inventory tracking,
  reorder level and backordering;
- record purchases, returns, damage and signed count adjustments;
- review recent stock movements and quantities reserved by orders.

The database already supports more images and variants. This first
manager screen deliberately manages one default variant so the
workflow remains clear while the domain stays extensible.

## Server-controlled boundaries

The browser never supplies authoritative:

- manager or user identity;
- storefront key;
- currency;
- reserved inventory;
- stock-movement actor or audit reference;
- product, variant or inventory identifiers during creation.

The configured storefront supplies `NGN` or `QAR`. A price update
deactivates the preceding price and creates a new active price, so
cart and order history can continue referring to historical prices.
Stock adjustments use the existing atomic inventory service and
cannot reduce on-hand stock below reserved stock.

`ACTIVE` products appear in the public live catalogue. `DRAFT`,
`HIDDEN`, and `ARCHIVED` products do not. Returning from the hosted
payment provider does not affect product publication, inventory, or
payment state.

## Product images

The manager may save either:

- an HTTPS image URL from an approved external media host; or
- a safe root-relative path for an image already committed under
  the application `public` directory.

Direct binary uploads are intentionally not written to Railway's
service filesystem because that filesystem is not durable product
storage. A future media milestone should connect an object-storage
service, apply file type/size checks, and then return a stable HTTPS
URL to this catalogue service. No object-storage credentials are
required for the current milestone.

## Railway staging

No new Railway variables or migrations are required. Deploy the
current `feat/commerce-foundation` branch, sign in as an approved
manager, and use the catalogue link from `/manager`.

The static audit is safe in every environment:

```text
npm run audit:catalog-management
```

The database lifecycle audit creates a temporary verified manager,
viewer, cross-store manager, product, historical price and stock
movements, verifies the access boundaries, then removes all
temporary records:

```text
npm run db:audit:catalog-management
```

Run the database audit against staging before creating a manual
staging product. Do not run it against production unless a separate
maintenance decision explicitly approves that diagnostic write.
