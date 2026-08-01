import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const storefronts = [
  {
    code: "ATI",
    home: "src/app/ng/atiloszy/page.tsx",
    shop: "src/app/ng/atiloszy/shop/page.tsx",
    cartColors: ["#176943", "#062317"],
    checkoutColors: ["#03130c", "#d8bd69"],
  },
  {
    code: "ZBF",
    home: "src/app/ng/zee-beauty-fashion/page.tsx",
    shop: "src/app/ng/zee-beauty-fashion/shop/page.tsx",
    cartColors: ["#99506f", "#4a102f"],
    checkoutColors: ["#4a102f", "#f2bed2"],
  },
  {
    code: "DEN",
    home: "src/app/ng/denald/page.tsx",
    shop: "src/app/ng/denald/shop/page.tsx",
    cartColors: ["#1667a4", "#f4c642"],
    checkoutColors: ["#071a31", "#f4c642"],
  },
  {
    code: "ZCH",
    home: "src/app/qa/zee-comfort-hub/page.tsx",
    shop: "src/app/qa/zee-comfort-hub/shop/page.tsx",
    cartColors: ["#9b5a6d", "#481428"],
    checkoutColors: ["#481428", "#efc4ce"],
  },
] as const;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function selectorBlock(source: string, selector: string): string {
  const start = source.indexOf(selector);
  assert.ok(start >= 0, `Missing theme selector ${selector}.`);
  const end = source.indexOf("}", start);
  assert.ok(end > start, `Theme selector ${selector} has no declaration block.`);
  return source.slice(start, end + 1).toLowerCase();
}

function main(): void {
  console.log("=== STOREFRONT COMMERCE UI AUDIT ===");

  for (const storefront of storefronts) {
    for (const path of [storefront.home, storefront.shop]) {
      const source = read(path);
      assert.ok(
        source.includes("StorefrontLiveCatalogSection") &&
          source.includes(`storefrontCode=\"${storefront.code}\"`),
        `${path} does not render the managed ${storefront.code} catalogue.`,
      );
      assert.ok(
        !source.includes("ProductCard") &&
          !source.match(/\b(?:atiloszy|zeeNigeria|denald|comfort)Products\b/u),
        `${path} still renders hardcoded demonstration products.`,
      );
    }
  }

  const catalogue = read(
    "src/components/catalog/storefront-live-catalog-section.tsx",
  );
  assert.ok(catalogue.includes('id="products"'));
  assert.ok(catalogue.includes("published by the"));
  assert.ok(!catalogue.includes("demonstration products above"));
  console.log("PASS: Public product sections use only manager-published catalogue data.");

  const cartComponent = read("src/components/cart/storefront-cart.tsx");
  const checkoutComponent = read(
    "src/components/checkout/storefront-checkout.tsx",
  );
  assert.ok(cartComponent.includes("data-cart-storefront"));
  assert.ok(checkoutComponent.includes("data-checkout-page"));

  const cartStyles = read(
    "src/components/cart/storefront-cart.module.css",
  );
  const checkoutStyles = read(
    "src/components/checkout/storefront-checkout.module.css",
  );

  for (const storefront of storefronts) {
    const cartTheme = selectorBlock(
      cartStyles,
      `.page[data-cart-storefront=\"${storefront.code}\"]`,
    );
    const checkoutTheme = selectorBlock(
      checkoutStyles,
      `.page[data-checkout-page=\"${storefront.code}\"]`,
    );

    for (const color of storefront.cartColors) {
      assert.ok(
        cartTheme.includes(color),
        `${storefront.code} cart theme is missing ${color}.`,
      );
    }
    for (const color of storefront.checkoutColors) {
      assert.ok(
        checkoutTheme.includes(color),
        `${storefront.code} checkout theme is missing ${color}.`,
      );
    }
  }

  assert.ok(cartStyles.includes("var(--cart-action)"));
  assert.ok(checkoutStyles.includes("var(--checkout-accent)"));
  console.log("PASS: Cart and checkout render four distinct storefront themes.");
  console.log("STOREFRONT COMMERCE UI AUDIT PASSED");
}

main();
