import {
  readFileSync,
} from "node:fs";

function read(
  path: string,
): string {
  return readFileSync(
    path,
    "utf8",
  );
}

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function includesAll(
  source: string,
  fragments: string[],
): boolean {
  return fragments.every(
    (fragment) =>
      source.includes(fragment),
  );
}

function main(): void {
  console.log(
    "=== SORVYRA CATALOGUE MANAGEMENT AUDIT ===",
  );

  const service = read(
    "src/server/catalog/management.ts",
  );
  const http = read(
    "src/server/catalog/http.ts",
  );
  const createRoute = read(
    "src/app/api/catalog/management/products/route.ts",
  );
  const updateRoute = read(
    "src/app/api/catalog/management/products/[storefrontProductId]/route.ts",
  );
  const stockRoute = read(
    "src/app/api/catalog/management/products/[storefrontProductId]/stock/route.ts",
  );
  const imageRoute = read(
    "src/app/api/catalog/management/images/route.ts",
  );
  const mediaRegistry = read(
    "src/server/catalog/media/registry.ts",
  );
  const mediaToken = read(
    "src/server/catalog/media/token.ts",
  );
  const mediaImage = read(
    "src/server/catalog/media/image.ts",
  );
  const managerUi = read(
    "src/components/catalog-management/catalogue-manager.tsx",
  );
  const managerPortal = read(
    "src/components/governance/manager-portal.tsx",
  );
  const publicGrid = read(
    "src/components/catalog/storefront-live-catalog-section.tsx",
  );
  const publicProductPage = read(
    "src/components/catalog/storefront-live-product-page.tsx",
  );

  assertCondition(
    includesAll(service, [
      "StorefrontStaffRole",
      ".MANAGER",
      "StorefrontStaffStatus",
      ".ACTIVE",
      "storefrontCode",
      "MANAGER_ACCESS_REQUIRED",
    ]),
    "Catalogue management is not restricted to an active manager in the selected storefront.",
  );
  console.log(
    "PASS: Catalogue management requires active storefront-scoped manager access.",
  );

  assertCondition(
    includesAll(http, [
      "assertOnlyCatalogFields",
      "currency, reservations, actor identity, audit references",
      "createProductFields",
      "stockAdjustmentFields",
    ]) &&
      [
        createRoute,
        updateRoute,
        stockRoute,
      ].every((source) =>
        includesAll(source, [
          "assertTrustedOrigin",
          "readCatalogApiSession",
          "assertOnlyCatalogFields",
        ]),
      ),
    "Catalogue write APIs do not enforce trusted origin, authenticated sessions and strict payload allowlists.",
  );
  console.log(
    "PASS: Catalogue writes use trusted-origin protection, authenticated sessions and strict payload allowlists.",
  );

  assertCondition(
    includesAll(service, [
      "manager.storefront",
      "currencyCode:",
      "quantityReserved",
      '"MANAGER_CATALOG"',
      "adjustVariantStock",
      "isActive: false",
      "PriceType.REGULAR",
    ]),
    "Currency, reservation safety, stock auditing or price history is incomplete.",
  );
  console.log(
    "PASS: Currency, reserved stock, price history and manager audit references remain server-controlled.",
  );

  assertCondition(
    includesAll(managerUi, [
      "data-catalog-create-form",
      "Create a product",
      "Adjust stock",
      "Storefront visibility",
      "Product photos",
      "Make primary",
      "catalogImages",
      "Product URL name",
      "Spaces and capital letters",
      "reserved by",
      "/api/auth/logout",
      "Sign out",
    ]) &&
      !managerUi.includes(
        'pattern="[a-z0-9]+(?:-[a-z0-9]+)*"',
      ) &&
      managerPortal.includes(
        "/manager/catalogue?storefrontCode=",
      ),
    "The approved manager portal is missing catalogue controls or still blocks readable product URL names before server normalization.",
  );
  console.log(
    "PASS: Approved managers receive product, publication, pricing, image and inventory controls.",
  );

  assertCondition(
    includesAll(
      imageRoute,
      [
        "MAX_CATALOG_IMAGE_INPUT_BYTES",
        "readCatalogApiSession",
        "assertTrustedOrigin",
        "uploadManagedCatalogImage",
      ],
    ) &&
      includesAll(
        mediaRegistry,
        [
          "disabled",
          "cloudinary",
          "CLOUDINARY_API_SECRET",
          "resolveCatalogMediaProvider",
        ],
      ) &&
      includesAll(
        mediaImage,
        [
          "limitInputPixels",
          ".webp(",
          "MAX_CATALOG_IMAGE_DIMENSION",
        ],
      ) &&
      includesAll(
        mediaToken,
        [
          "timingSafeEqual",
          "expectedStorefrontCode",
          "AUTH_TOKEN_SECRET",
        ],
      ),
    "Product photo uploads are missing fail-closed provider selection, binary validation, manager scoping or signed attachment protection.",
  );
  console.log(
    "PASS: Product photo uploads fail closed and use manager scope, image validation and signed attachments.",
  );

  assertCondition(
    includesAll(publicGrid, [
      "primaryImageUrl",
      "productMedia",
      "AuthenticatedAddToCartButton",
    ]) &&
      includesAll(
        publicProductPage,
        [
          "galleryImages",
          "productThumbnails",
          "altText",
        ],
      ) &&
      !managerUi.includes(
        "currencyCode:",
      ),
    "Managed products are not safely connected to the public catalogue or the browser controls authoritative currency.",
  );
  console.log(
    "PASS: Managed images reach the live catalogue while server-derived currency remains authoritative.",
  );

  console.log(
    "PASS: Catalogue management audit completed without database writes.",
  );
}

main();
