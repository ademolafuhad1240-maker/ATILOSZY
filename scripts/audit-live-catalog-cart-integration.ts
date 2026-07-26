import {
  type ChildProcessByStdio,
  spawn,
} from "node:child_process";
import {
  randomBytes,
  randomInt,
} from "node:crypto";
import type {
  Readable,
} from "node:stream";

import {
  ProductStatus,
  StorefrontProductStatus,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  createCatalogProduct,
} from "../src/server/catalog";
import {
  normalizeEmail,
  registerCustomer,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";

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
    "=== LIVE CATALOGUE CART INTEGRATION AUDIT ===",
  );

  const tokenSecret =
    process.env.AUTH_TOKEN_SECRET;

  assertCondition(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const token = randomBytes(7)
    .toString("hex");

  const email =
    `live-catalog-${token}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phone =
    `+234709${`${Date.now()}`.slice(-7)}`;

  const productName =
    `Live catalogue audit product ${token}`;

  const category =
    await prisma.category.findFirstOrThrow(
      {
        where: {
          storefront: {
            key: "atiloszy",
          },
        },
      },
    );

  let productId:
    | string
    | null = null;

  const registration =
    await registerCustomer({
      storefrontCode: "ATI",
      email,
      phone,
      password:
        `Live-Catalog-Passphrase-${token}`,
      firstName: "Live",
      lastName: "Catalogue Audit",
      marketingOptIn: false,
      termsAccepted: true,
      privacyAccepted: true,
      tokenSecret,
    });

  await verifyCustomerEmail({
    storefrontCode: "ATI",
    token:
      registration
        .emailVerificationToken,
    tokenSecret,
  });

  await verifyCustomerPhone({
    storefrontCode: "ATI",
    challengeId:
      registration.phoneChallengeId,
    code:
      registration
        .phoneVerificationCode,
    tokenSecret,
  });

  const created =
    await createCatalogProduct({
      storefrontKey: "atiloszy",
      categorySlug:
        category.slug,
      listingSlug:
        `live-catalog-${token}`,
      name: productName,
      shortDescription:
        "Temporary live catalogue integration product.",
      productStatus:
        ProductStatus.ACTIVE,
      listingStatus:
        StorefrontProductStatus.ACTIVE,
      publishedAt: new Date(
        Date.now() - 60_000,
      ),
      isDemo: true,
      maxPerOrder: 5,
      variant: {
        sku:
          `ATI-LIVE-${token}`,
        title: "Audit variant",
        price: {
          amount: "12500.00",
        },
        initialStock: 7,
        isTracked: true,
        allowBackorder: false,
      },
    });

  productId = created.productId;

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
    stream.on("data", (
      chunk: Buffer,
    ) => {
      serverLogs = (
        serverLogs +
        chunk.toString("utf8")
      ).slice(-18000);
    });
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

    const shopRoutes = [
      [
        "/ng/atiloszy/shop",
        "ATI",
      ],
      [
        "/ng/zee-beauty-fashion/shop",
        "ZBF",
      ],
      [
        "/ng/denald/shop",
        "DEN",
      ],
      [
        "/qa/zee-comfort-hub/shop",
        "ZCH",
      ],
    ] as const;

    for (
      const [
        route,
        code,
      ] of shopRoutes
    ) {
      const response =
        await fetch(
          `${baseUrl}${route}`,
        );

      const html =
        await response.text();

      assertCondition(
        response.status === 200,
        `${code} shop page failed.`,
      );

      assertCondition(
        html.includes(
          `data-live-catalog-storefront="${code}"`,
        ),
        `${code} live catalogue marker is missing.`,
      );
    }

    console.log(
      "PASS: All storefront shop pages render live catalogue sections.",
    );

    const atiShop =
      await fetch(
        `${baseUrl}/ng/atiloszy/shop`,
      );

    const atiShopHtml =
      await atiShop.text();

    assertCondition(
      atiShopHtml.includes(
        productName,
      ),
      "The live ATI product did not render in its shop.",
    );

    assertCondition(
      atiShopHtml.includes(
        `/ng/atiloszy/shop/live-catalog-${token}`,
      ),
      "The live product detail link was missing.",
    );

    console.log(
      "PASS: Published database products render in their storefront.",
    );

    const detail =
      await fetch(
        `${baseUrl}/ng/atiloszy/shop/live-catalog-${token}`,
      );

    const detailHtml =
      await detail.text();

    assertCondition(
      detail.status === 200,
      "The live product detail page failed.",
    );

    assertCondition(
      detailHtml.includes(
        `data-live-product-page="live-catalog-${token}"`,
      ),
      "The live product-page marker was missing.",
    );

    assertCondition(
      detailHtml.includes(
        `data-product-variant-id="${created.variantId}"`,
      ),
      "The real product variant was not rendered.",
    );

    console.log(
      "PASS: Storefront product detail pages use real catalogue variants.",
    );

    const loginResponse =
      await fetch(
        `${baseUrl}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Origin: baseUrl,
          },
          body: JSON.stringify({
            storefrontCode: "ATI",
            email,
            password:
              `Live-Catalog-Passphrase-${token}`,
          }),
        },
      );

    assertCondition(
      loginResponse.status === 200,
      "The integration customer could not sign in.",
    );

    const setCookie =
      loginResponse.headers.get(
        "set-cookie",
      );

    assertCondition(
      setCookie,
      "Login did not return a storefront session cookie.",
    );

    const cookie =
      setCookie.split(";")[0];

    const addResponse =
      await fetch(
        `${baseUrl}/api/cart/items`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Origin: baseUrl,
            Cookie: cookie,
          },
          body: JSON.stringify({
            storefrontCode: "ATI",
            productVariantId:
              created.variantId,
            quantity: 2,
          }),
        },
      );

    assertCondition(
      addResponse.status === 201,
      "The live product could not be added to the authenticated cart.",
    );

    const cartPage =
      await fetch(
        `${baseUrl}/ng/atiloszy/cart`,
        {
          headers: {
            Cookie: cookie,
          },
        },
      );

    const cartHtml =
      await cartPage.text();

    assertCondition(
      cartPage.status === 200,
      "The authenticated cart page failed.",
    );

    assertCondition(
      cartHtml.includes(
        productName,
      ),
      "The live catalogue product did not reach the storefront cart.",
    );

    console.log(
      "PASS: Live catalogue products reach the authenticated storefront cart.",
    );

    console.log(
      "PASS: Live catalogue cart integration audit completed.",
    );
  } catch (error) {
    console.error(
      "=== PRODUCTION SERVER LOG TAIL ===",
    );

    console.error(serverLogs);

    throw error;
  } finally {
    await stopServer(server);

    await prisma.user.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    if (productId) {
      await prisma.product.deleteMany({
        where: {
          id: productId,
        },
      });
    }

    console.log(
      "PASS: Temporary live catalogue audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
