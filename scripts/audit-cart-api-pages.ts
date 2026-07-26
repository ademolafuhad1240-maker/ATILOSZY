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
  PriceType,
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

interface HttpResult {
  status: number;
  text: string;
  json: unknown;
  setCookie: string | null;
  location: string | null;
}

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function asRecord(
  value: unknown,
): Record<string, unknown> {
  assertCondition(
    typeof value === "object" &&
      value !== null &&
      !Array.isArray(value),
    "Expected an object response.",
  );

  return value as
    Record<string, unknown>;
}

function nestedRecord(
  record:
    Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return asRecord(record[key]);
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
    let settled = false;

    let timer:
      | ReturnType<typeof setTimeout>
      | null = null;

    const finish = (
      exited: boolean,
    ): void => {
      if (settled) {
        return;
      }

      settled = true;

      if (timer) {
        clearTimeout(timer);
      }

      server.removeListener(
        "exit",
        handleExit,
      );

      resolve(exited);
    };

    const handleExit = (): void => {
      finish(true);
    };

    server.once(
      "exit",
      handleExit,
    );

    timer = setTimeout(
      () => finish(false),
      timeoutMilliseconds,
    );
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

async function categorySlugFor(
  storefrontKey: string,
): Promise<string> {
  const storefront =
    await prisma.storefront.findUniqueOrThrow(
      {
        where: {
          key: storefrontKey,
        },
        select: {
          categories: {
            take: 1,
            select: {
              slug: true,
            },
          },
        },
      },
    );

  const category =
    storefront.categories[0];

  assertCondition(
    category,
    `No category exists for ${storefrontKey}.`,
  );

  return category.slug;
}

async function createAuditProduct(
  input: {
    storefrontKey: string;
    skuPrefix: string;
    token: string;
    amount: string;
  },
) {
  return createCatalogProduct({
    storefrontKey:
      input.storefrontKey,
    categorySlug:
      await categorySlugFor(
        input.storefrontKey,
      ),
    listingSlug:
      `cart-api-${input.token}`,
    name:
      `Temporary ${input.storefrontKey} cart API product`,
    shortDescription:
      "Temporary authenticated cart API audit product.",
    description:
      "Automatically removed after the cart API audit.",
    brand:
      "SORVYRA Cart API Audit",
    productStatus:
      ProductStatus.ACTIVE,
    listingStatus:
      StorefrontProductStatus.ACTIVE,
    publishedAt: new Date(
      Date.now() - 60_000,
    ),
    maxPerOrder: 8,
    isDemo: true,
    variant: {
      sku:
        `${input.skuPrefix}-CAPI-${input.token}`,
      title: "Audit variant",
      price: {
        amount: input.amount,
      },
      initialStock: 12,
      reorderLevel: 1,
      isTracked: true,
      allowBackorder: false,
    },
  });
}

async function main(): Promise<void> {
  console.log(
    "=== AUTHENTICATED CART API AND PAGE AUDIT ===",
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
    `cart-api-${token}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phone =
    `+234708${`${Date.now()}`.slice(-7)}`;

  const password =
    `Cart-API-Passphrase-${token}`;

  const productIds:
    string[] = [];

  const registration =
    await registerCustomer({
      storefrontCode: "ATI",
      email,
      phone,
      password,
      firstName: "Cart",
      lastName: "API Audit",
      displayName:
        "ATI Cart API Audit",
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

  const atiProduct =
    await createAuditProduct({
      storefrontKey: "atiloszy",
      skuPrefix: "ATI",
      token: `${token}-ati`,
      amount: "15000.00",
    });

  const zbfProduct =
    await createAuditProduct({
      storefrontKey:
        "zee-beauty-fashion",
      skuPrefix: "ZBF",
      token: `${token}-zbf`,
      amount: "19000.00",
    });

  productIds.push(
    atiProduct.productId,
    zbfProduct.productId,
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

  const captureLogs = (
    chunk: Buffer,
  ): void => {
    serverLogs = (
      serverLogs +
      chunk.toString("utf8")
    ).slice(-18000);
  };

  server.stdout.on(
    "data",
    captureLogs,
  );

  server.stderr.on(
    "data",
    captureLogs,
  );

  async function request(
    method: string,
    path: string,
    input?: {
      body?: unknown;
      cookie?: string;
      origin?: string;
    },
  ): Promise<HttpResult> {
    const headers:
      Record<string, string> = {
        Accept: "application/json",
      };

    if (
      input?.body !== undefined
    ) {
      headers["Content-Type"] =
        "application/json";

      headers.Origin =
        input.origin ??
        baseUrl;
    }

    if (input?.cookie) {
      headers.Cookie =
        input.cookie;
    }

    const response = await fetch(
      `${baseUrl}${path}`,
      {
        method,
        headers,
        body:
          input?.body === undefined
            ? undefined
            : JSON.stringify(
                input.body,
              ),
        redirect: "manual",
      },
    );

    const text =
      await response.text();

    let json: unknown = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    return {
      status: response.status,
      text,
      json,
      setCookie:
        response.headers.get(
          "set-cookie",
        ),
      location:
        response.headers.get(
          "location",
        ),
    };
  }

  try {
    let ready = false;

    for (
      let attempt = 0;
      attempt < 60;
      attempt += 1
    ) {
      if (server.exitCode !== null) {
        break;
      }

      try {
        const response =
          await fetch(baseUrl);

        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // Server is still starting.
      }

      await delay(500);
    }

    if (!ready) {
      throw new Error(
        "The production server did not become ready.\n" +
        serverLogs,
      );
    }

    console.log(
      "PASS: Production Next.js server started.",
    );

    for (
      const cartPath of [
        "/ng/atiloszy/cart",
        "/ng/zee-beauty-fashion/cart",
        "/ng/denald/cart",
        "/qa/zee-comfort-hub/cart",
      ]
    ) {
      const response =
        await request(
          "GET",
          cartPath,
        );

      assertCondition(
        response.status >= 300 &&
          response.status < 400,
        `${cartPath} was not protected.`,
      );
    }

    console.log(
      "PASS: All storefront cart pages require authentication.",
    );

    const unauthenticatedApi =
      await request(
        "GET",
        "/api/cart?storefrontCode=ATI",
      );

    assertCondition(
      unauthenticatedApi.status ===
        401,
      "Unauthenticated cart API access was accepted.",
    );

    console.log(
      "PASS: Cart APIs require a storefront session.",
    );

    const login =
      await request(
        "POST",
        "/api/auth/login",
        {
          body: {
            storefrontCode: "ATI",
            email,
            password,
          },
        },
      );

    assertCondition(
      login.status === 200,
      "The audit customer could not sign in.",
    );

    assertCondition(
      login.setCookie,
      "Login did not set a session cookie.",
    );

    const cookiePair =
      login.setCookie.split(";")[0];

    const cartPage =
      await request(
        "GET",
        "/ng/atiloszy/cart",
        {
          cookie: cookiePair,
        },
      );

    assertCondition(
      cartPage.status === 200,
      "The authenticated ATI cart page did not load.",
    );

    assertCondition(
      cartPage.text.includes(
        'data-cart-storefront="ATI"',
      ),
      "The ATI cart page marker was not rendered.",
    );

    console.log(
      "PASS: Authenticated storefront cart page rendered.",
    );

    const initialCart =
      await request(
        "GET",
        "/api/cart?storefrontCode=ATI",
        {
          cookie: cookiePair,
        },
      );

    assertCondition(
      initialCart.status === 200,
      "The active cart API failed.",
    );

    assertCondition(
      !initialCart.text.includes(
        registration.user.id,
      ),
      "The cart API exposed the internal user ID.",
    );

    const initialRoot =
      asRecord(
        initialCart.json,
      );

    const initialData =
      nestedRecord(
        initialRoot,
        "data",
      );

    const initialView =
      nestedRecord(
        initialData,
        "cart",
      );

    assertCondition(
      initialView.itemCount === 0,
      "The initial API cart was not empty.",
    );

    console.log(
      "PASS: Active cart API returns a safe public view.",
    );

    const crossOrigin =
      await request(
        "POST",
        "/api/cart/items",
        {
          cookie: cookiePair,
          origin:
            "https://malicious.example",
          body: {
            storefrontCode: "ATI",
            productVariantId:
              atiProduct.variantId,
            quantity: 1,
          },
        },
      );

    assertCondition(
      crossOrigin.status === 403,
      "Cross-origin cart mutation was accepted.",
    );

    console.log(
      "PASS: Cross-origin cart mutations are rejected.",
    );

    const wrongStoreProduct =
      await request(
        "POST",
        "/api/cart/items",
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
            productVariantId:
              zbfProduct.variantId,
            quantity: 1,
          },
        },
      );

    assertCondition(
      wrongStoreProduct.status ===
        409,
      "A cross-store product was accepted.",
    );

    console.log(
      "PASS: API product storefront isolation completed.",
    );

    const added =
      await request(
        "POST",
        "/api/cart/items",
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
            productVariantId:
              atiProduct.variantId,
            quantity: 2,
          },
        },
      );

    assertCondition(
      added.status === 201,
      "A valid cart item could not be added.",
    );

    const addedCart =
      nestedRecord(
        nestedRecord(
          asRecord(added.json),
          "data",
        ),
        "cart",
      );

    assertCondition(
      addedCart.itemCount === 2,
      "The added quantity was incorrect.",
    );

    const addedItems =
      addedCart.items;

    assertCondition(
      Array.isArray(addedItems) &&
        addedItems.length === 1,
      "The added cart line was missing.",
    );

    const addedItem =
      asRecord(
        addedItems[0],
      );

    const itemId =
      addedItem.id;

    assertCondition(
      typeof itemId === "string",
      "The cart item ID was missing.",
    );

    console.log(
      "PASS: Authenticated cart item creation completed.",
    );

    const updated =
      await request(
        "PATCH",
        `/api/cart/items/${encodeURIComponent(itemId)}`,
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
            quantity: 3,
          },
        },
      );

    assertCondition(
      updated.status === 200,
      "The cart quantity update failed.",
    );

    const updatedCart =
      nestedRecord(
        nestedRecord(
          asRecord(updated.json),
          "data",
        ),
        "cart",
      );

    assertCondition(
      updatedCart.itemCount === 3,
      "The updated quantity was incorrect.",
    );

    assertCondition(
      updatedCart.subtotal ===
        "45000.00",
      "The updated cart subtotal was incorrect.",
    );

    console.log(
      "PASS: Authenticated cart quantity updates completed.",
    );

    const validation =
      await request(
        "GET",
        "/api/cart/validate?storefrontCode=ATI",
        {
          cookie: cookiePair,
        },
      );

    assertCondition(
      validation.status === 200,
      "The cart validation endpoint failed.",
    );

    const validationView =
      nestedRecord(
        nestedRecord(
          asRecord(validation.json),
          "data",
        ),
        "validation",
      );

    assertCondition(
      validationView.valid === true,
      "A valid cart was reported as invalid.",
    );

    console.log(
      "PASS: Authenticated cart validation completed.",
    );

    const storefront =
      await prisma.storefront.findUniqueOrThrow(
        {
          where: {
            code: "ATI",
          },
        },
      );

    await prisma.storefrontPrice.create({
      data: {
        productVariantId:
          atiProduct.variantId,
        currencyCode:
          storefront.currencyCode,
        type: PriceType.SALE,
        amount: "12000.00",
        compareAtAmount:
          "15000.00",
        isActive: true,
        startsAt: new Date(
          Date.now() - 60_000,
        ),
      },
    });

    const refreshed =
      await request(
        "POST",
        "/api/cart/refresh",
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
          },
        },
      );

    assertCondition(
      refreshed.status === 200,
      "The cart refresh endpoint failed.",
    );

    const refreshedCart =
      nestedRecord(
        nestedRecord(
          asRecord(refreshed.json),
          "data",
        ),
        "cart",
      );

    assertCondition(
      refreshedCart.subtotal ===
        "36000.00",
      "The refreshed sale subtotal was incorrect.",
    );

    console.log(
      "PASS: Authenticated cart price refresh completed.",
    );

    const removed =
      await request(
        "DELETE",
        `/api/cart/items/${encodeURIComponent(itemId)}`,
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
          },
        },
      );

    assertCondition(
      removed.status === 200,
      "The cart item removal failed.",
    );

    const removedCart =
      nestedRecord(
        nestedRecord(
          asRecord(removed.json),
          "data",
        ),
        "cart",
      );

    assertCondition(
      removedCart.itemCount === 0,
      "The cart item was not removed.",
    );

    await request(
      "POST",
      "/api/cart/items",
      {
        cookie: cookiePair,
        body: {
          storefrontCode: "ATI",
          productVariantId:
            atiProduct.variantId,
          quantity: 1,
        },
      },
    );

    const cleared =
      await request(
        "DELETE",
        "/api/cart",
        {
          cookie: cookiePair,
          body: {
            storefrontCode: "ATI",
          },
        },
      );

    assertCondition(
      cleared.status === 200,
      "The cart clear endpoint failed.",
    );

    const clearedCart =
      nestedRecord(
        nestedRecord(
          asRecord(cleared.json),
          "data",
        ),
        "cart",
      );

    assertCondition(
      clearedCart.itemCount === 0,
      "The cart was not cleared.",
    );

    console.log(
      "PASS: Authenticated cart removal and clearing completed.",
    );

    const isolatedSession =
      await request(
        "GET",
        "/api/cart?storefrontCode=ZBF",
        {
          cookie: cookiePair,
        },
      );

    assertCondition(
      isolatedSession.status === 401,
      "An ATI session accessed the ZBF cart.",
    );

    console.log(
      "PASS: Cart sessions remain storefront-isolated.",
    );

    console.log(
      "PASS: Authenticated cart API and page audit completed.",
    );
  } catch (error) {
    if (serverLogs) {
      console.error(
        "=== PRODUCTION SERVER LOG TAIL ===",
      );

      console.error(serverLogs);
    }

    throw error;
  } finally {
    await stopServer(server);

    await prisma.user.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    if (productIds.length > 0) {
      await prisma.product.deleteMany({
        where: {
          id: {
            in: productIds,
          },
        },
      });
    }

    console.log(
      "PASS: Temporary cart API audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
