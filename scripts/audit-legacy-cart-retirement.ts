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
