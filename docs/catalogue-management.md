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

- create a draft or active product with one or more sellable variants;
- set its name, descriptions, brand and category;
- upload, preview, describe, reorder and remove up to eight product
  photos, with the first photo used as the storefront cover;
- set size and colour combinations, each with its own locked SKU,
  regular price, compare-at price, internal cost and opening stock;
- define how each variant is sold (`item`, `3-piece pack`, `half-dozen`,
  `dozen`, or another clear selling-unit name) and how many pieces it
  contains;
- add up to ten quantity price breaks, such as a lower price per dozen
  when the customer buys three or more dozens;
- publish, hide, return to draft or archive a listing;
- configure featured status and per-order limits, plus variant-specific
  inventory tracking, reorder levels, availability and backordering;
- record variant-specific purchases, returns, damage and signed count
  adjustments;
- review recent stock movements and quantities reserved by orders.

The database and public product page support ordered image galleries
and multiple variants. A manager adds one row for every sellable size
and colour combination. Existing variants are never deleted through a
routine edit because carts and orders may refer to them; managers mark
them unavailable instead. The public catalogue requires the customer
to choose the exact variant before adding a multi-variant product to
the cart.

## Server-controlled boundaries

The browser never supplies authoritative:

- manager or user identity;
- storefront key;
- currency;
- reserved inventory;
- stock-movement actor or audit reference;
- product, variant or inventory identifiers during creation.
- image-storage credentials, storage keys or durable image metadata.

The configured storefront supplies `NGN` or `QAR`. A price update
deactivates the preceding price and creates a new active price, so
cart and order history can continue referring to historical prices.
Stock adjustments use the existing atomic inventory service and
cannot reduce on-hand stock below reserved stock.

Selling-unit metadata is stored on `ProductVariant`. Quantity price
breaks are children of the historical `StorefrontPrice` record, so a
later manager price change cannot rewrite an old order's calculation.
The cart always resolves the highest eligible price break, and checkout
recalculates it server-side before reserving inventory. The browser does
not control the authoritative unit price, discount, currency, threshold,
or order total.

Inventory and cart quantities count sellable units, not loose pieces.
For example, a variant configured as `dozen` with 12 pieces and stock 5
has five sellable dozens (60 pieces). A customer quantity of 3 means
three dozens, and a “minimum 3” price break applies to all three dozens.
The order snapshots the selling-unit name, pieces per unit, base
subtotal, applied discount, and final total.

This milestone adds an additive Prisma migration for selling-unit
snapshots and historical quantity-price tiers. It does not require a new
Railway environment variable.

`ACTIVE` products appear in the public live catalogue. `DRAFT`,
`HIDDEN`, and `ARCHIVED` products do not. Returning from the hosted
payment provider does not affect product publication, inventory, or
payment state.

## Product images

Product images use a provider-neutral server abstraction. Supported
configured values are:

```text
CATALOG_MEDIA_PROVIDER=disabled
CATALOG_MEDIA_PROVIDER=cloudinary
```

`disabled` is the default. An unknown provider or an incomplete
Cloudinary configuration fails closed; the application never falls
back to another storage provider during an upload.

The manager sends the selected file to an authenticated,
trusted-origin SORVYRA route. The server:

1. confirms an active `MANAGER` membership for the selected
   storefront;
2. accepts only JPEG, PNG or WebP input up to 8 MB;
3. decodes the binary image with a 25-megapixel safety limit;
4. applies orientation, limits dimensions to 2400 by 2400, removes
   embedded metadata and normalizes the result to WebP;
5. uploads the normalized file to a server-generated Cloudinary
   public ID under `sorvyra-store/<storefront-code>/`;
6. returns only a stable HTTPS URL and a short-lived, signed
   attachment token; and
7. verifies that token again when the product is saved.

The Cloudinary API secret is used only on the server. It is never
returned to the browser, stored in product records or included in
provider errors. The attachment token is storefront-specific,
expires after two hours and prevents a browser from inventing the
authoritative storage key or metadata.

The product record stores the stable URL, storage provider/key,
media type, size and dimensions. Railway's service filesystem is
never used for uploaded product photos. Removing a photo from a
product removes the catalogue association immediately. Permanent
provider-side garbage collection is deliberately separate so a
routine catalogue edit cannot irreversibly delete the only stored
copy of a merchant asset.

Existing root-relative and HTTPS catalogue images continue to render.
Managers use the upload control for new photos rather than entering
external URLs.

### Local setup

Use a separate Cloudinary product environment for development or
staging. Keep the provider disabled until credentials are available:

```text
CATALOG_MEDIA_PROVIDER=disabled
```

To exercise uploads locally, place non-production values only in the
ignored `.env` file:

```text
CATALOG_MEDIA_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=<development-cloud-name>
CLOUDINARY_API_KEY=<development-api-key>
CLOUDINARY_API_SECRET=<development-api-secret>
CATALOG_MEDIA_UPLOAD_TIMEOUT_MS=15000
```

Never commit credentials, paste them into documentation, or reuse a
production API secret in local development.

## Railway staging

The product-image metadata migration is applied by Railway's existing
`npm run db:deploy` pre-deploy command. The migration adds nullable
metadata columns and a uniqueness constraint; it does not rewrite or
remove existing image records.

For a staging Cloudinary product environment, add these sealed
Railway variables:

```text
CATALOG_MEDIA_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=<staging-cloud-name>
CLOUDINARY_API_KEY=<staging-api-key>
CLOUDINARY_API_SECRET=<sealed-staging-api-secret>
CATALOG_MEDIA_UPLOAD_TIMEOUT_MS=15000
```

Use a different Cloudinary product environment and credentials for
production. Do not add production credentials to staging.

The static audit is safe in every environment:

```text
npm run audit:catalog-management
npm run audit:catalog-media
npm run audit:quantity-pricing
```

The database lifecycle audit creates a temporary verified manager,
viewer, cross-store manager, product, ordered photo gallery,
historical price and stock movements, verifies the access
boundaries, then removes all temporary database records:

```text
npm run db:audit:catalog-management
```

Run the database audit against staging before creating a manual
staging product. Do not run it against production unless a separate
maintenance decision explicitly approves that diagnostic write.
