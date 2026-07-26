#!/usr/bin/env bash

set -Eeuo pipefail

DETAIL_LOG="/tmp/sorvyra-phase-2f-d-b-details.log"
: >"$DETAIL_LOG"

run_quiet() {
  local label="$1"
  shift

  echo
  echo "=== $label ==="

  if "$@" >>"$DETAIL_LOG" 2>&1; then
    echo "PASS: $label"
  else
    echo "FAIL: $label"
    echo
    echo "=== FAILURE LOG TAIL ==="
    tail -n 180 "$DETAIL_LOG"
    exit 1
  fi
}

echo "=== VERIFY CLEAN CHECKPOINT ==="

test "$(git branch --show-current)" = \
  "feat/commerce-foundation"

UNEXPECTED_CHANGES="$(
  git status --porcelain |
  grep -v \
    '^?? scripts/setup-legacy-cart-retirement.sh$' ||
  true
)"

if [ -n "$UNEXPECTED_CHANGES" ]; then
  echo "Unexpected repository changes exist:"
  printf '%s\n' "$UNEXPECTED_CHANGES"
  exit 1
fi

echo "Branch: $(git branch --show-current)"
echo "Starting commit: $(git rev-parse --short HEAD)"
echo "PASS: Working tree is clean."

echo
echo "=== VERIFY LEGACY CART FOUNDATION ==="

python - <<'PY'
from pathlib import Path

required = [
    Path("src/components/cart/cart-provider.tsx"),
    Path("src/components/cart/add-to-cart-button.tsx"),
    Path("src/app/cart/page.tsx"),
    Path("src/app/layout.tsx"),
    Path("src/components/layout/header.tsx"),
    Path("src/components/commerce/product-card.tsx"),
    Path("src/app/product/[slug]/page.tsx"),
    Path("src/lib/storefront-catalog.ts"),
]

for path in required:
    if not path.exists():
        raise RuntimeError(
            f"Required legacy-cart file is missing: {path}"
        )

provider = Path(
    "src/components/cart/cart-provider.tsx"
).read_text(
    encoding="utf-8",
)

for value in [
    "localStorage",
    "CartProvider",
    "useCart",
]:
    if value not in provider:
        raise RuntimeError(
            f"Legacy cart contract is missing: {value}"
        )

print(
    "PASS: Legacy browser-cart implementation is present and ready for retirement."
)
PY

echo
echo "=== CREATE GLOBAL STOREFRONT PURCHASE CTA ==="

cat > src/components/cart/storefront-purchase-cta.tsx <<'TS'
import Link from "next/link";

import styles from "./storefront-purchase-cta.module.css";

export default function StorefrontPurchaseCta({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <aside
      className={
        compact
          ? styles.compact
          : styles.panel
      }
      data-storefront-purchase-cta
    >
      <div>
        <p
          className={
            styles.eyebrow
          }
        >
          SORVYRA discovery
        </p>

        <p
          className={
            styles.message
          }
        >
          This preview is not connected
          to verified live inventory yet.
          Choose an owned storefront to
          view current products, prices
          and availability.
        </p>
      </div>

      <Link
        className={styles.link}
        href="/cart"
      >
        Choose a storefront
      </Link>
    </aside>
  );
}
TS

cat > src/components/cart/storefront-purchase-cta.module.css <<'CSS'
.panel,
.compact {
  display: grid;
  gap: 1rem;
  border: 1px solid
    rgba(16, 24, 39, 0.1);
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.98),
      rgba(245, 239, 226, 0.96)
    );
  box-shadow:
    0 18px 48px
    rgba(16, 24, 39, 0.08);
}

.panel {
  border-radius: 1.25rem;
  padding: 1.25rem;
}

.compact {
  border-radius: 1rem;
  padding: 1rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: #957234;
  font-size: 0.7rem;
  font-weight: 850;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.message {
  margin: 0;
  color: #606873;
  font-size: 0.86rem;
  line-height: 1.55;
}

.link {
  display: inline-flex;
  min-height: 2.8rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.72rem 1rem;
  background: #101827;
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 850;
  letter-spacing: 0.04em;
  text-decoration: none;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.link:hover {
  transform: translateY(-1px);
}
CSS

echo
echo "=== CREATE SECURE CART SELECTOR ==="

cat > src/components/cart/storefront-cart-selector.tsx <<'TS'
import Link from "next/link";

import {
  getStorefrontCatalogConfig,
  type StorefrontCatalogConfig,
} from "../../lib/storefront-catalog";

import styles from "./storefront-cart-selector.module.css";

const storefrontCodes:
  StorefrontCatalogConfig["code"][] = [
    "ATI",
    "ZBF",
    "DEN",
    "ZCH",
  ];

const descriptions:
  Record<
    StorefrontCatalogConfig["code"],
    string
  > = {
    ATI:
      "Shoes, household products, gadgets and everyday essentials in Nigeria.",
    ZBF:
      "Beauty, fashion, personal care and household essentials in Nigeria.",
    DEN:
      "Solar, CCTV, computers and technical equipment in Nigeria.",
    ZCH:
      "Women’s comfort fashion, sleepwear and everyday essentials in Qatar.",
  };

export default function StorefrontCartSelector() {
  const storefronts =
    storefrontCodes.map(
      getStorefrontCatalogConfig,
    );

  return (
    <main
      className={styles.page}
      data-secure-cart-selector
    >
      <div className={styles.shell}>
        <header
          className={
            styles.header
          }
        >
          <p
            className={
              styles.eyebrow
            }
          >
            SORVYRA STORE
          </p>

          <h1
            className={
              styles.title
            }
          >
            Choose your storefront cart
          </h1>

          <p
            className={
              styles.description
            }
          >
            Every SORVYRA business has
            its own account, currency,
            catalogue and secure cart.
            Select the store where you
            are shopping.
          </p>
        </header>

        <section
          className={styles.grid}
          aria-label="SORVYRA storefront carts"
        >
          {storefronts.map(
            (storefront) => (
              <article
                className={
                  styles.card
                }
                data-cart-selector-storefront={
                  storefront.code
                }
                key={
                  storefront.code
                }
              >
                <p
                  className={
                    styles.code
                  }
                >
                  {storefront.code}
                </p>

                <h2
                  className={
                    styles.storeName
                  }
                >
                  {storefront.name}
                </h2>

                <p
                  className={
                    styles.storeDescription
                  }
                >
                  {
                    descriptions[
                      storefront.code
                    ]
                  }
                </p>

                <div
                  className={
                    styles.actions
                  }
                >
                  <Link
                    className={
                      styles.primaryLink
                    }
                    href={
                      storefront.cartHref
                    }
                  >
                    Open secure cart
                  </Link>

                  <Link
                    className={
                      styles.secondaryLink
                    }
                    href={
                      storefront.shopHref
                    }
                  >
                    Browse store
                  </Link>
                </div>
              </article>
            ),
          )}
        </section>

        <aside
          className={styles.notice}
        >
          Products from one storefront
          cannot be added to another
          storefront’s cart. This protects
          prices, currency, inventory and
          customer accounts.
        </aside>
      </div>
    </main>
  );
}
TS

cat > src/components/cart/storefront-cart-selector.module.css <<'CSS'
.page {
  min-height: 100vh;
  padding: clamp(
    2rem,
    7vw,
    6rem
  ) 1rem;
  background:
    radial-gradient(
      circle at 80% 5%,
      rgba(202, 164, 87, 0.19),
      transparent 31rem
    ),
    radial-gradient(
      circle at 10% 75%,
      rgba(39, 124, 108, 0.13),
      transparent 28rem
    ),
    #07111d;
  color: #ffffff;
}

.shell {
  width: min(1180px, 100%);
  margin: 0 auto;
}

.header {
  max-width: 55rem;
  margin-bottom: 2.4rem;
}

.eyebrow {
  margin: 0 0 0.7rem;
  color: #d7b967;
  font-size: 0.75rem;
  font-weight: 850;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.title {
  margin: 0;
  max-width: 48rem;
  font-size: clamp(
    2.5rem,
    7vw,
    5.6rem
  );
  line-height: 0.94;
  letter-spacing: -0.06em;
}

.description {
  max-width: 44rem;
  margin: 1.2rem 0 0;
  color: rgba(
    255,
    255,
    255,
    0.67
  );
  font-size: 1rem;
  line-height: 1.75;
}

.grid {
  display: grid;
  grid-template-columns:
    repeat(
      2,
      minmax(0, 1fr)
    );
  gap: 1rem;
}

.card {
  display: grid;
  align-content: start;
  min-height: 21rem;
  border: 1px solid
    rgba(255, 255, 255, 0.11);
  border-radius: 1.7rem;
  padding: clamp(
    1.25rem,
    4vw,
    2rem
  );
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.035)
    );
  box-shadow:
    0 28px 80px
    rgba(0, 0, 0, 0.2);
  backdrop-filter:
    blur(18px);
}

.card[data-cart-selector-storefront="ZBF"],
.card[data-cart-selector-storefront="ZCH"] {
  background:
    linear-gradient(
      145deg,
      rgba(142, 43, 76, 0.34),
      rgba(255, 255, 255, 0.035)
    );
}

.card[data-cart-selector-storefront="DEN"] {
  background:
    linear-gradient(
      145deg,
      rgba(26, 104, 124, 0.32),
      rgba(255, 255, 255, 0.035)
    );
}

.code {
  margin: 0 0 2rem;
  color: #d7b967;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.2em;
}

.storeName {
  margin: 0;
  font-size: clamp(
    1.6rem,
    4vw,
    2.6rem
  );
  line-height: 1;
  letter-spacing: -0.04em;
}

.storeDescription {
  margin: 1rem 0 1.5rem;
  color: rgba(
    255,
    255,
    255,
    0.66
  );
  line-height: 1.65;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: auto;
}

.primaryLink,
.secondaryLink {
  display: inline-flex;
  min-height: 2.9rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.75rem 1rem;
  font-size: 0.78rem;
  font-weight: 850;
  text-decoration: none;
}

.primaryLink {
  background: #ffffff;
  color: #101827;
}

.secondaryLink {
  border: 1px solid
    rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.notice {
  margin-top: 1.2rem;
  border: 1px solid
    rgba(215, 185, 103, 0.22);
  border-radius: 1.25rem;
  padding: 1rem 1.15rem;
  background:
    rgba(215, 185, 103, 0.08);
  color: rgba(
    255,
    255,
    255,
    0.68
  );
  line-height: 1.6;
}

@media (max-width: 760px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .card {
    min-height: auto;
  }
}
CSS

echo
echo "=== REPLACE GLOBAL CART PAGE ==="

cat > src/app/cart/page.tsx <<'TS'
import type {
  Metadata,
} from "next";

import StorefrontCartSelector from "../../components/cart/storefront-cart-selector";

export const metadata: Metadata = {
  title:
    "Choose a Storefront Cart | SORVYRA STORE",
  description:
    "Open the secure cart for the SORVYRA storefront where you are shopping.",
};

export default function CartPage() {
  return (
    <StorefrontCartSelector />
  );
}
TS

echo
echo "=== REMOVE ROOT CART PROVIDER ==="

python - <<'PY'
from pathlib import Path

path = Path(
    "src/app/layout.tsx"
)

content = path.read_text(
    encoding="utf-8",
)

content = "\n".join(
    line
    for line in content.splitlines()
    if (
        "components/cart/cart-provider"
        not in line
    )
) + "\n"

content = content.replace(
    "        <CartProvider>\n",
    "",
)

content = content.replace(
    "        </CartProvider>\n",
    "",
)

if "CartProvider" in content:
    raise RuntimeError(
        "A CartProvider reference remains in the root layout."
    )

path.write_text(
    content,
    encoding="utf-8",
)

print(
    "PASS: Root layout no longer installs the browser cart provider."
)
PY

echo
echo "=== REMOVE MISLEADING HEADER COUNT ==="

python - <<'PYHEADER'
from pathlib import Path

path = Path(
    "src/components/layout/header.tsx"
)

content = path.read_text(
    encoding="utf-8",
)

old = '''            <Link
              href="/cart"
              aria-label="Shopping bag"
              className="relative grid h-11 w-11 place-items-center text-white/80 transition hover:text-white"
            >
              <ShoppingBag size={20} strokeWidth={1.6} />
              <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-[#d4ad55] px-1 text-[8px] font-extrabold text-[#0a1119]">
                0
              </span>
            </Link>'''

new = '''            <Link
              href="/cart"
              aria-label="Choose storefront cart"
              className="relative grid h-11 w-11 place-items-center text-white/80 transition hover:text-white"
            >
              <ShoppingBag size={20} strokeWidth={1.6} />
            </Link>'''

if old in content:
    content = content.replace(
        old,
        new,
        1,
    )

    print(
        "PASS: Removed the hard-coded header cart count."
    )
elif new in content:
    print(
        "PASS: Header cart count was already removed."
    )
else:
    raise RuntimeError(
        "Could not locate the expected ShoppingBag link block."
    )

if (
    'aria-label="Shopping bag"'
    in content
):
    raise RuntimeError(
        "The old Shopping bag label remains."
    )

if (
    'aria-label="Choose storefront cart"'
    not in content
):
    raise RuntimeError(
        "The storefront cart label is missing."
    )

path.write_text(
    content,
    encoding="utf-8",
)

print(
    "PASS: Header cart link now opens the storefront selector without a fake count."
)
PYHEADER

echo

echo "=== REPLACE GLOBAL PRODUCT CARD CART CONTROL ==="

cat > src/components/commerce/product-card.tsx <<'TS'
import Image from "next/image";
import Link from "next/link";

import StorefrontPurchaseCta from "../cart/storefront-purchase-cta";
import ProductPrice from "./product-price";
import type {
  Product,
} from "../../types/commerce";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({
  product,
}: ProductCardProps) {
  return (
    <article
      className="group flex h-full flex-col"
      data-discovery-product={
        product.slug
      }
    >
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden bg-[#eee8dc]"
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
        />

        {product.badge ? (
          <span className="absolute left-4 top-4 bg-[#fbf8f1] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#171815]">
            {product.badge}
          </span>
        ) : null}

        <span className="absolute inset-x-4 bottom-4 translate-y-4 bg-[#fbf8f1]/95 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[#171815] opacity-0 shadow-xl backdrop-blur transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          View product
        </span>
      </Link>

      <div className="flex flex-1 flex-col pt-5">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#9b7c3d]">
          {product.categorySlug
            .split("-")
            .join(" ")}
        </p>

        <Link
          href={`/product/${product.slug}`}
        >
          <h3 className="font-display text-2xl font-semibold leading-tight text-[#171815] transition-colors group-hover:text-[#896b32]">
            {product.name}
          </h3>
        </Link>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#74766f]">
          {product.shortDescription}
        </p>

        <div className="mt-4">
          <ProductPrice
            price={product.price}
            compareAtPrice={
              product.compareAtPrice
            }
          />
        </div>

        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#806b45]">
          Discovery preview
        </p>

        <div className="mt-5">
          <StorefrontPurchaseCta
            compact
          />
        </div>
      </div>
    </article>
  );
}
TS

echo
echo "=== REPLACE GLOBAL PRODUCT DETAIL CART CONTROL ==="

python - <<'PY'
from pathlib import Path

path = Path(
    "src/app/product/[slug]/page.tsx"
)

content = path.read_text(
    encoding="utf-8",
)

old_import = (
    "import AddToCartButton from "
    "'@/components/cart/add-to-cart-button';"
)

new_import = (
    "import StorefrontPurchaseCta from "
    "'@/components/cart/storefront-purchase-cta';"
)

if old_import not in content:
    raise RuntimeError(
        "Legacy product-detail cart import was not found."
    )

content = content.replace(
    old_import,
    new_import,
    1,
)

old_block = '''              {/* Add to Cart */}
              <div className="mb-8">
                <AddToCartButton
                  product={product}
                  disabled={product.inventoryStatus === 'out_of_stock'}
                />
              </div>'''

new_block = '''              {/* Storefront selection */}
              <div className="mb-8">
                <StorefrontPurchaseCta />
              </div>'''

if old_block not in content:
    raise RuntimeError(
        "Legacy product-detail add-to-cart block was not found."
    )

content = content.replace(
    old_block,
    new_block,
    1,
)

path.write_text(
    content,
    encoding="utf-8",
)

print(
    "PASS: Global product detail pages now direct customers to verified storefront inventory."
)
PY

echo
echo "=== REMOVE OBSOLETE CART TYPE ==="

python - <<'PY'
from pathlib import Path
import re

path = Path(
    "src/types/commerce.ts"
)

content = path.read_text(
    encoding="utf-8",
)

pattern = re.compile(
    r'''
\nexport\ interface\ CartItem\ \{
\n\ \ productId:\ string;
\n\ \ quantity:\ number;
\n\}
''',
    re.VERBOSE,
)

content, count = pattern.subn(
    "",
    content,
    count=1,
)

if count != 1:
    raise RuntimeError(
        "Could not remove the obsolete CartItem interface."
    )

path.write_text(
    content.rstrip() + "\n",
    encoding="utf-8",
)

print(
    "PASS: Obsolete browser-cart type was removed."
)
PY

echo
echo "=== DELETE LEGACY CART IMPLEMENTATION ==="

rm \
  src/components/cart/cart-provider.tsx \
  src/components/cart/add-to-cart-button.tsx

echo "PASS: Legacy provider and browser add-to-cart button were deleted."

echo
echo "=== CREATE LEGACY CART RETIREMENT AUDIT ==="

cat > scripts/audit-legacy-cart-retirement.ts <<'TS'
import {
  type ChildProcessByStdio,
  spawn,
} from "node:child_process";
import {
  randomInt,
} from "node:crypto";
import {
  readFile,
  readdir,
  stat,
} from "node:fs/promises";
import {
  join,
} from "node:path";
import type {
  Readable,
} from "node:stream";

type TestServer =
  ChildProcessByStdio<
    null,
    Readable,
    Readable
  >;

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function collectSourceFiles(
  directory: string,
): Promise<string[]> {
  const entries =
    await readdir(directory);

  const files: string[] = [];

  for (const entry of entries) {
    const path =
      join(directory, entry);

    const details =
      await stat(path);

    if (details.isDirectory()) {
      files.push(
        ...await collectSourceFiles(
          path,
        ),
      );

      continue;
    }

    if (
      path.endsWith(".ts") ||
      path.endsWith(".tsx")
    ) {
      files.push(path);
    }
  }

  return files;
}

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForExit(
  server: TestServer,
  timeoutMilliseconds: number,
): Promise<boolean> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return true;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve(false),
      timeoutMilliseconds,
    );

    server.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function stopServer(
  server: TestServer,
): Promise<void> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return;
  }

  server.kill("SIGTERM");

  if (
    await waitForExit(
      server,
      5000,
    )
  ) {
    return;
  }

  server.kill("SIGKILL");

  await waitForExit(
    server,
    2000,
  );
}

async function main(): Promise<void> {
  console.log(
    "=== LEGACY CART RETIREMENT AUDIT ===",
  );

  const sourceFiles =
    await collectSourceFiles(
      "src",
    );

  const forbidden = [
    "CartProvider",
    "useCart",
    "atiloszy_cart",
    "localStorage",
    "@/components/cart/add-to-cart-button",
];

  for (
    const path of sourceFiles
  ) {
    const content =
      await readFile(
        path,
        "utf8",
      );

    for (
      const value of forbidden
    ) {
      assertCondition(
        !content.includes(value),
        `${value} remains in ${path}.`,
      );
    }
  }

  console.log(
    "PASS: No legacy browser-cart implementation remains in source files.",
  );

  const cartPage =
    await readFile(
      "src/app/cart/page.tsx",
      "utf8",
    );

  const selector =
    await readFile(
      "src/components/cart/storefront-cart-selector.tsx",
      "utf8",
    );

  for (
    const value of [
      "/ng/atiloszy/cart",
      "/ng/zee-beauty-fashion/cart",
      "/ng/denald/cart",
      "/qa/zee-comfort-hub/cart",
    ]
  ) {
    assertCondition(
      selector.includes(value) ||
      selector.includes(
        "storefront.cartHref",
      ),
      `Secure cart selector is missing ${value}.`,
    );
  }

  assertCondition(
    cartPage.includes(
      "StorefrontCartSelector",
    ),
    "The global cart route is not using the secure selector.",
  );

  console.log(
    "PASS: Global cart route delegates to the four secure storefront carts.",
  );

  const productCard =
    await readFile(
      "src/components/commerce/product-card.tsx",
      "utf8",
    );

  const productPage =
    await readFile(
      "src/app/product/[slug]/page.tsx",
      "utf8",
    );

  assertCondition(
    productCard.includes(
      "StorefrontPurchaseCta",
    ),
    "Global product cards do not expose storefront selection.",
  );

  assertCondition(
    productPage.includes(
      "StorefrontPurchaseCta",
    ),
    "Global product pages do not expose storefront selection.",
  );

  console.log(
    "PASS: Global discovery products no longer pretend to have live cart inventory.",
  );

  const port = randomInt(
    45001,
    51000,
  );

  const baseUrl =
    `http://127.0.0.1:${port}`;

  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      String(port),
      "-H",
      "127.0.0.1",
    ],
    {
      env: {
        ...process.env,
        APP_ORIGIN: baseUrl,
      },
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    },
  );

  let serverLogs = "";

  for (
    const stream of [
      server.stdout,
      server.stderr,
    ]
  ) {
    stream.on(
      "data",
      (
        chunk: Buffer,
      ) => {
        serverLogs = (
          serverLogs +
          chunk.toString("utf8")
        ).slice(-16000);
      },
    );
  }

  try {
    let ready = false;

    for (
      let attempt = 0;
      attempt < 60;
      attempt += 1
    ) {
      try {
        const response =
          await fetch(baseUrl);

        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // Server is starting.
      }

      await delay(500);
    }

    assertCondition(
      ready,
      "Production server did not become ready.\n" +
      serverLogs,
    );

    console.log(
      "PASS: Production Next.js server started.",
    );

    const cartResponse =
      await fetch(
        `${baseUrl}/cart`,
      );

    const cartHtml =
      await cartResponse.text();

    assertCondition(
      cartResponse.status === 200,
      "Global cart selector page failed.",
    );

    assertCondition(
      cartHtml.includes(
        "data-secure-cart-selector",
      ),
      "Secure cart selector marker is missing.",
    );

    for (
      const code of [
        "ATI",
        "ZBF",
        "DEN",
        "ZCH",
      ]
    ) {
      assertCondition(
        cartHtml.includes(
          `data-cart-selector-storefront="${code}"`,
        ),
        `${code} selector card did not render.`,
      );
    }

    console.log(
      "PASS: Secure storefront cart selector rendered all four businesses.",
    );

    const shopResponse =
      await fetch(
        `${baseUrl}/shop`,
      );

    const shopHtml =
      await shopResponse.text();

    assertCondition(
      shopResponse.status === 200,
      "Global product discovery page failed.",
    );

    assertCondition(
      shopHtml.includes(
        "data-storefront-purchase-cta",
      ),
      "Global product cards are missing the storefront CTA.",
    );

    const productResponse =
      await fetch(
        `${baseUrl}/product/sculpted-aroma-diffuser`,
      );

    const productHtml =
      await productResponse.text();

    assertCondition(
      productResponse.status === 200,
      "Global product detail page failed.",
    );

    assertCondition(
      productHtml.includes(
        "data-storefront-purchase-cta",
      ),
      "Global product detail page is missing storefront selection.",
    );

    console.log(
      "PASS: Global discovery pages render safe storefront-selection controls.",
    );

    for (
      const path of [
        "/ng/atiloszy/cart",
        "/ng/zee-beauty-fashion/cart",
        "/ng/denald/cart",
        "/qa/zee-comfort-hub/cart",
      ]
    ) {
      const response =
        await fetch(
          `${baseUrl}${path}`,
          {
            redirect: "manual",
          },
        );

      assertCondition(
        response.status >= 300 &&
        response.status < 400,
        `${path} is no longer protected by authentication.`,
      );
    }

    console.log(
      "PASS: All four secure storefront carts remain authentication-protected.",
    );

    console.log(
      "PASS: Legacy cart retirement audit completed.",
    );
  } catch (error) {
    console.error(
      "=== PRODUCTION SERVER LOG TAIL ===",
    );

    console.error(serverLogs);

    throw error;
  } finally {
    await stopServer(server);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
TS

echo
echo "=== REGISTER LEGACY CART RETIREMENT AUDIT ==="

npm pkg set \
  "scripts.db:audit:legacy-cart-retirement=node --env-file=.env --conditions=react-server --import tsx scripts/audit-legacy-cart-retirement.ts"

echo
echo "=== VERIFY LEGACY REFERENCES ARE GONE ==="

python - <<'PY'
from pathlib import Path

forbidden = [
    "CartProvider",
    "useCart",
    "atiloszy_cart",
    "localStorage",
    "@/components/cart/add-to-cart-button",
]

issues = []

for path in Path("src").rglob("*"):
    if (
        not path.is_file()
        or path.suffix
        not in {
            ".ts",
            ".tsx",
        }
    ):
        continue

    content = path.read_text(
        encoding="utf-8",
    )

    for value in forbidden:
        if value in content:
            issues.append(
                f"{value}: {path}"
            )

if issues:
    raise RuntimeError(
        "Legacy cart references remain:\n" +
        "\n".join(issues)
    )

for deleted in [
    Path(
        "src/components/cart/cart-provider.tsx"
    ),
    Path(
        "src/components/cart/add-to-cart-button.tsx"
    ),
]:
    if deleted.exists():
        raise RuntimeError(
            f"Legacy cart file remains: {deleted}"
        )

print(
    "PASS: Legacy localStorage cart implementation has been fully removed."
)
PY

run_quiet \
  "VALIDATE DATABASE SCHEMA" \
  npm run db:validate

run_quiet \
  "VERIFY MIGRATION STATUS" \
  npx prisma migrate status

run_quiet \
  "ESLINT" \
  npm run lint

run_quiet \
  "PRODUCTION BUILD" \
  npm run build

echo
echo "=== RUN LEGACY CART RETIREMENT AUDIT ==="

if npm run db:audit:legacy-cart-retirement \
  2>&1 |
  tee -a "$DETAIL_LOG"
then
  echo "PASS: Legacy cart retirement audit"
else
  echo "FAIL: Legacy cart retirement audit"
  exit 1
fi

run_quiet \
  "LIVE CATALOGUE REGRESSION AUDIT" \
  npm run db:audit:live-catalog

run_quiet \
  "CART API REGRESSION AUDIT" \
  npm run db:audit:cart-api

run_quiet \
  "CART SERVICE REGRESSION AUDIT" \
  npm run db:audit:cart-services

run_quiet \
  "CATALOGUE SERVICE REGRESSION AUDIT" \
  npm run db:audit:services

run_quiet \
  "AUTHENTICATION PAGE REGRESSION AUDIT" \
  npm run db:audit:auth-ui

echo
echo "=== VERIFY NO TEST SERVER REMAINS ==="

if ps -ef |
  grep -E \
    '[n]ode_modules/next/dist/bin/next start' \
  >/tmp/sorvyra-phase-2f-d-b-server-check.txt
then
  echo "A temporary Next.js server remains:"
  cat \
    /tmp/sorvyra-phase-2f-d-b-server-check.txt
  exit 1
fi

echo "PASS: No temporary test server remains."

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "Detailed validation log:"
echo "$DETAIL_LOG"

echo
echo "PHASE 2F-D-B LEGACY CART RETIREMENT PASSED"
