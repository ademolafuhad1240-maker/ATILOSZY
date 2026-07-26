import {
  spawn,
  type ChildProcess,
} from "node:child_process";
import {
  closeSync,
  openSync,
} from "node:fs";
import {
  randomBytes,
  randomInt,
} from "node:crypto";

import {
  CartStatus,
  OrderFulfilmentMethod,
  OrderStatus,
  ProductStatus,
  StorefrontProductStatus,
} from "../src/generated/prisma/client";
import {
  prisma,
} from "../src/lib/prisma";
import {
  registerCustomer,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";
import {
  addCartItem,
  getOrCreateActiveCart,
} from "../src/server/cart";
import {
  createCatalogProduct,
} from "../src/server/catalog";

interface HttpResult {
  status: number;
  body: unknown;
  setCookie: string | null;
}

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function objectField(
  value: unknown,
  field: string,
): Record<string, unknown> {
  assertCondition(
    isRecord(value),
    "Expected a JSON object.",
  );

  const discovered =
    value[field];

  assertCondition(
    isRecord(discovered),
    `Expected ${field} to be an object.`,
  );

  return discovered;
}

function stringField(
  value:
    Record<string, unknown>,
  field: string,
): string {
  const discovered =
    value[field];

  assertCondition(
    typeof discovered ===
      "string",
    `Expected ${field} to be a string.`,
  );

  return discovered;
}

async function categorySlugFor(
  storefrontKey: string,
): Promise<string> {
  const category =
    await prisma.category.findFirst({
      where: {
        storefront: {
          key:
            storefrontKey,
        },
      },
      select: {
        slug: true,
      },
    });

  assertCondition(
    category,
    `No category exists for ${storefrontKey}.`,
  );

  return category.slug;
}

async function activateCustomer(
  input: {
    storefrontCode: string;
    email: string;
    phone: string;
    password: string;
    tokenSecret: string;
  },
) {
  const registration =
    await registerCustomer({
      storefrontCode:
        input.storefrontCode,
      email:
        input.email,
      phone:
        input.phone,
      password:
        input.password,
      firstName:
        "Checkout",
      lastName:
        `${input.storefrontCode} API Audit`,
      displayName:
        `${input.storefrontCode} Checkout API`,
      marketingOptIn: false,
      termsAccepted: true,
      privacyAccepted: true,
      tokenSecret:
        input.tokenSecret,
    });

  await verifyCustomerEmail({
    storefrontCode:
      input.storefrontCode,
    token:
      registration
        .emailVerificationToken,
    tokenSecret:
      input.tokenSecret,
  });

  await verifyCustomerPhone({
    storefrontCode:
      input.storefrontCode,
    challengeId:
      registration
        .phoneChallengeId,
    code:
      registration
        .phoneVerificationCode,
    tokenSecret:
      input.tokenSecret,
  });

  return registration.user;
}

function npmCommand(): string {
  return process.platform ===
    "win32"
    ? "npm.cmd"
    : "npm";
}

async function waitForServer(
  baseUrl: string,
  server: ChildProcess,
): Promise<void> {
  const startedAt =
    Date.now();

  while (
    Date.now() - startedAt <
    60_000
  ) {
    if (
      server.exitCode !== null
    ) {
      throw new Error(
        `Next.js server exited with code ${server.exitCode}.`,
      );
    }

    try {
      const response =
        await fetch(baseUrl);

      if (
        response.status >= 200
      ) {
        return;
      }
    } catch {
      // The server is still starting.
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          500,
        ),
    );
  }

  throw new Error(
    "Timed out waiting for the Next.js server.",
  );
}

async function stopServer(
  server:
    ChildProcess | null,
): Promise<void> {
  if (
    !server ||
    server.exitCode !== null
  ) {
    return;
  }

  server.kill(
    "SIGTERM",
  );

  await Promise.race([
    new Promise<void>(
      (resolve) => {
        server.once(
          "exit",
          () => resolve(),
        );
      },
    ),
    new Promise<void>(
      (resolve) =>
        setTimeout(
          resolve,
          5000,
        ),
    ),
  ]);

  if (
    server.exitCode === null
  ) {
    server.kill(
      "SIGKILL",
    );
  }
}

async function main(): Promise<void> {
  console.log(
    "=== AUTHENTICATED CHECKOUT AND ORDER API AUDIT ===",
  );

  const tokenSecret =
    process.env
      .AUTH_TOKEN_SECRET;

  assertCondition(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const token =
    randomBytes(8)
      .toString("hex")
      .toUpperCase();

  const lowerToken =
    token.toLowerCase();

  const atiEmail =
    `checkout-api-ati-${lowerToken}@example.test`;

  const zbfEmail =
    `checkout-api-zbf-${lowerToken}@example.test`;

  const atiPassword =
    `Checkout-Api-${token}-Password1!`;

  const zbfPassword =
    `Checkout-Api-ZBF-${token}-Password1!`;

  const userIds: string[] = [];
  const productIds: string[] = [];
  const variantIds: string[] = [];

  let server:
    ChildProcess | null = null;

  let serverLogFd:
    number | null = null;

  try {
    const atiUser =
      await activateCustomer({
        storefrontCode: "ATI",
        email: atiEmail,
        phone:
          `+23480${randomInt(
            10_000_000,
            99_999_999,
          )}`,
        password:
          atiPassword,
        tokenSecret,
      });

    const zbfUser =
      await activateCustomer({
        storefrontCode: "ZBF",
        email: zbfEmail,
        phone:
          `+23481${randomInt(
            10_000_000,
            99_999_999,
          )}`,
        password:
          zbfPassword,
        tokenSecret,
      });

    userIds.push(
      atiUser.id,
      zbfUser.id,
    );

    const product =
      await createCatalogProduct({
        storefrontKey:
          "atiloszy",
        categorySlug:
          await categorySlugFor(
            "atiloszy",
          ),
        listingSlug:
          `checkout-api-${lowerToken}`,
        name:
          `Temporary checkout API product ${token}`,
        shortDescription:
          "Temporary checkout API audit product.",
        description:
          "Automatically removed after the checkout API audit.",
        brand:
          "SORVYRA Checkout API Audit",
        productStatus:
          ProductStatus.ACTIVE,
        listingStatus:
          StorefrontProductStatus.ACTIVE,
        publishedAt:
          new Date(
            Date.now() -
              60_000,
          ),
        maxPerOrder: 5,
        isDemo: true,
        variant: {
          sku:
            `ATI-CHECKOUT-API-${token}`,
          title:
            "Checkout API audit variant",
          price: {
            amount:
              "12500.00",
          },
          initialStock: 10,
          reorderLevel: 1,
          isTracked: true,
          allowBackorder: false,
        },
      });

    productIds.push(
      product.productId,
    );

    variantIds.push(
      product.variantId,
    );

    const cart =
      await getOrCreateActiveCart({
        storefrontCode: "ATI",
        userId: atiUser.id,
      });

    await addCartItem({
      storefrontCode: "ATI",
      userId: atiUser.id,
      productVariantId:
        product.variantId,
      quantity: 2,
    });

    const port =
      randomInt(
        34000,
        39000,
      );

    const baseUrl =
      `http://127.0.0.1:${port}`;

    serverLogFd =
      openSync(
        "/tmp/sorvyra-phase-2g-c-next-server.log",
        "w",
      );

    server = spawn(
      npmCommand(),
      [
        "run",
        "start",
        "--",
        "-p",
        String(port),
        "-H",
        "127.0.0.1",
      ],
      {
        env: {
          ...process.env,
          APP_URL:
            baseUrl,
          NEXT_PUBLIC_APP_URL:
            baseUrl,
          AUTH_TRUSTED_ORIGINS:
            baseUrl,
          PORT:
            String(port),
        },
        stdio: [
          "ignore",
          serverLogFd,
          serverLogFd,
        ],
      },
    );

    await waitForServer(
      baseUrl,
      server,
    );

    async function request(
      path: string,
      input?: {
        method?: string;
        body?: unknown;
        cookie?: string;
        origin?: string;
        fetchSite?: string;
      },
    ): Promise<HttpResult> {
      const headers:
        Record<string, string> = {
          Accept:
            "application/json",
        };

      if (
        input?.body !==
        undefined
      ) {
        headers[
          "Content-Type"
        ] =
          "application/json";
      }

      if (input?.cookie) {
        headers.Cookie =
          input.cookie;
      }

      if (input?.origin) {
        headers.Origin =
          input.origin;
      }

      if (
        input?.fetchSite
      ) {
        headers[
          "Sec-Fetch-Site"
        ] =
          input.fetchSite;
      }

      const response =
        await fetch(
          `${baseUrl}${path}`,
          {
            method:
              input?.method ??
              "GET",
            headers,
            body:
              input?.body ===
              undefined
                ? undefined
                : JSON.stringify(
                    input.body,
                  ),
            redirect:
              "manual",
          },
        );

      const text =
        await response.text();

      let body: unknown =
        null;

      if (text) {
        try {
          body =
            JSON.parse(text);
        } catch {
          body = text;
        }
      }

      return {
        status:
          response.status,
        body,
        setCookie:
          response.headers.get(
            "set-cookie",
          ),
      };
    }

    const unauthenticated =
      await request(
        "/api/checkout",
        {
          method: "POST",
          origin: baseUrl,
          fetchSite:
            "same-origin",
          body: {
            storefrontCode:
              "ATI",
            cartId:
              cart.id,
            fulfilmentMethod:
              OrderFulfilmentMethod
                .PICKUP,
          },
        },
      );

    assertCondition(
      unauthenticated.status ===
        401,
      "Unauthenticated checkout did not return 401.",
    );

    console.log(
      "PASS: Checkout requires an authenticated storefront session.",
    );

    const atiLogin =
      await request(
        "/api/auth/login",
        {
          method: "POST",
          origin: baseUrl,
          fetchSite:
            "same-origin",
          body: {
            storefrontCode:
              "ATI",
            email:
              atiEmail,
            password:
              atiPassword,
          },
        },
      );

    assertCondition(
      atiLogin.status ===
        200,
      "ATI login failed.",
    );

    assertCondition(
      atiLogin.setCookie,
      "ATI login did not set a session cookie.",
    );

    const atiCookie =
      atiLogin.setCookie
        .split(";")[0];

    const zbfLogin =
      await request(
        "/api/auth/login",
        {
          method: "POST",
          origin: baseUrl,
          fetchSite:
            "same-origin",
          body: {
            storefrontCode:
              "ZBF",
            email:
              zbfEmail,
            password:
              zbfPassword,
          },
        },
      );

    assertCondition(
      zbfLogin.status ===
        200,
      "ZBF login failed.",
    );

    assertCondition(
      zbfLogin.setCookie,
      "ZBF login did not set a session cookie.",
    );

    const zbfCookie =
      zbfLogin.setCookie
        .split(";")[0];

    const crossOrigin =
      await request(
        "/api/checkout",
        {
          method: "POST",
          cookie:
            atiCookie,
          origin:
            "https://malicious.example",
          fetchSite:
            "cross-site",
          body: {
            storefrontCode:
              "ATI",
            cartId:
              cart.id,
            fulfilmentMethod:
              OrderFulfilmentMethod
                .PICKUP,
          },
        },
      );

    assertCondition(
      crossOrigin.status ===
        403,
      "Cross-origin checkout was not rejected.",
    );

    console.log(
      "PASS: Checkout mutation rejects untrusted origins.",
    );

    const created =
      await request(
        "/api/checkout",
        {
          method: "POST",
          cookie:
            atiCookie,
          origin:
            baseUrl,
          fetchSite:
            "same-origin",
          body: {
            storefrontCode:
              "ATI",
            cartId:
              cart.id,
            fulfilmentMethod:
              OrderFulfilmentMethod
                .DELIVERY,
            deliveryAddress: {
              recipientName:
                "Checkout API Audit",
              phone:
                "+2348000000000",
              email:
                atiEmail,
              countryCode:
                "NG",
              state:
                "Osun",
              city:
                "Osogbo",
              addressLine1:
                "Temporary checkout API address",
              deliveryNotes:
                "Temporary audit only",
            },
            customerNote:
              "Checkout API audit.",
          },
        },
      );

    assertCondition(
      created.status ===
        200,
      `Checkout creation returned ${created.status}.`,
    );

    const createdOrder =
      objectField(
        created.body,
        "order",
      );

    const orderId =
      stringField(
        createdOrder,
        "id",
      );

    const orderNumber =
      stringField(
        createdOrder,
        "orderNumber",
      );

    assertCondition(
      stringField(
        createdOrder,
        "status",
      ) ===
        OrderStatus
          .PENDING_PAYMENT,
      "Checkout API returned the wrong order status.",
    );

    assertCondition(
      stringField(
        createdOrder,
        "productTotal",
      ) ===
        "25000.00",
      "Checkout API returned the wrong product total.",
    );

    console.log(
      "PASS: Checkout API created an authenticated storefront order.",
    );

    const repeated =
      await request(
        "/api/checkout",
        {
          method: "POST",
          cookie:
            atiCookie,
          origin:
            baseUrl,
          fetchSite:
            "same-origin",
          body: {
            storefrontCode:
              "ATI",
            cartId:
              cart.id,
            fulfilmentMethod:
              OrderFulfilmentMethod
                .DELIVERY,
            deliveryAddress: {
              recipientName:
                "Checkout API Audit",
              phone:
                "+2348000000000",
              countryCode:
                "NG",
              state:
                "Osun",
              city:
                "Osogbo",
              addressLine1:
                "Temporary checkout API address",
            },
          },
        },
      );

    assertCondition(
      repeated.status ===
        200,
      "Repeated checkout API request failed.",
    );

    assertCondition(
      stringField(
        objectField(
          repeated.body,
          "order",
        ),
        "id",
      ) ===
        orderId,
      "Repeated checkout API request created another order.",
    );

    console.log(
      "PASS: Checkout API preserves cart idempotency.",
    );

    const fetched =
      await request(
        `/api/orders/${encodeURIComponent(
          orderNumber,
        )}?storefrontCode=ATI`,
        {
          cookie:
            atiCookie,
        },
      );

    assertCondition(
      fetched.status ===
        200,
      "Authenticated order lookup failed.",
    );

    assertCondition(
      stringField(
        objectField(
          fetched.body,
          "order",
        ),
        "id",
      ) ===
        orderId,
      "Order lookup returned the wrong order.",
    );

    const unauthenticatedOrder =
      await request(
        `/api/orders/${encodeURIComponent(
          orderNumber,
        )}?storefrontCode=ATI`,
      );

    assertCondition(
      unauthenticatedOrder
        .status === 401,
      "Unauthenticated order lookup did not return 401.",
    );

    const crossStoreOrder =
      await request(
        `/api/orders/${encodeURIComponent(
          orderNumber,
        )}?storefrontCode=ZBF`,
        {
          cookie:
            zbfCookie,
        },
      );

    assertCondition(
      crossStoreOrder.status ===
        404,
      "Cross-store order lookup did not return 404.",
    );

    console.log(
      "PASS: Customer-order API enforces storefront and customer isolation.",
    );

    const cancelled =
      await request(
        `/api/orders/${encodeURIComponent(
          orderNumber,
        )}/cancel`,
        {
          method: "POST",
          cookie:
            atiCookie,
          origin:
            baseUrl,
          fetchSite:
            "same-origin",
          body: {
            storefrontCode:
              "ATI",
            reason:
              "Checkout API audit cancellation.",
          },
        },
      );

    assertCondition(
      cancelled.status ===
        200,
      "Order cancellation API failed.",
    );

    assertCondition(
      stringField(
        objectField(
          cancelled.body,
          "order",
        ),
        "status",
      ) ===
        OrderStatus.CANCELLED,
      "Order cancellation API returned the wrong status.",
    );

    const storedCart =
      await prisma.cart.findUniqueOrThrow(
        {
          where: {
            id: cart.id,
          },
        },
      );

    assertCondition(
      storedCart.status ===
        CartStatus.ABANDONED,
      "Cancelled checkout did not abandon the source cart.",
    );

    const inventory =
      await prisma.inventory.findFirstOrThrow(
        {
          where: {
            productVariantId:
              product.variantId,
          },
        },
      );

    assertCondition(
      inventory.quantityReserved ===
        0,
      "Cancelled checkout did not release reserved inventory.",
    );

    console.log(
      "PASS: Customer cancellation API releases reserved inventory.",
    );

    console.log(
      "PASS: Authenticated checkout and customer-order API audit completed.",
    );
  } finally {
    await stopServer(
      server,
    );

    if (
      serverLogFd !== null
    ) {
      closeSync(
        serverLogFd,
      );

      serverLogFd = null;
    }

    if (
      variantIds.length > 0
    ) {
      await prisma.inventory.updateMany(
        {
          where: {
            productVariantId: {
              in: variantIds,
            },
          },
          data: {
            quantityReserved: 0,
          },
        },
      );
    }

    if (
      userIds.length > 0
    ) {
      await prisma.order.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      });

      await prisma.cart.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });
    }

    if (
      productIds.length > 0
    ) {
      await prisma.product.deleteMany({
        where: {
          id: {
            in: productIds,
          },
        },
      });
    }

    console.log(
      "PASS: Temporary checkout API audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch(
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
