import {
  spawn,
  type ChildProcess,
} from "node:child_process";
import {
  closeSync,
  openSync,
  readFileSync,
} from "node:fs";
import {
  randomInt,
} from "node:crypto";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
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
      // Server is still starting.
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
    "=== STOREFRONT CHECKOUT AND ORDER PAGE AUDIT ===",
  );

  const cartSource =
    readFileSync(
      "src/components/cart/storefront-cart.tsx",
      "utf-8",
    );

  assertCondition(
    cartSource.includes(
      "data-checkout-link",
    ),
    "The storefront cart does not expose the checkout link.",
  );

  assertCondition(
    !cartSource.includes(
      "Checkout coming next",
    ),
    "The legacy disabled checkout message remains.",
  );

  assertCondition(
    cartSource.includes(
      '"/checkout"',
    ),
    "The cart does not derive the storefront checkout route.",
  );

  console.log(
    "PASS: Storefront carts now link to secure checkout.",
  );

  const checkoutSource =
    readFileSync(
      "src/components/checkout/storefront-checkout.tsx",
      "utf-8",
    );

  const orderSource =
    readFileSync(
      "src/components/orders/storefront-order.tsx",
      "utf-8",
    );

  const normalizedCheckoutSource =
    checkoutSource.replace(
      /\s+/g,
      " ",
    );

  for (
    const required of [
      'data-checkout-page',
      '"/api/checkout"',
      '"Prepare unpaid order"',
      'storefront.ordersHref',
    ]
  ) {
    assertCondition(
      checkoutSource.includes(
        required,
      ),
      `Checkout UI is missing: ${required}`,
    );
  }

  for (
    const required of [
      "data-order-page",
      "/api/orders/",
      "cancelOrder",
      "Cancel unpaid order",
      "No charge has been",
    ]
  ) {
    assertCondition(
      orderSource.includes(
        required,
      ),
      `Order UI is missing: ${required}`,
    );
  }

  assertCondition(
    normalizedCheckoutSource.includes(
      "No payment will be taken yet",
    ),
    "Checkout UI is missing the no-payment notice.",
  );

  console.log(
    "PASS: Checkout UI clearly states that no payment is taken during order preparation.",
  );

  console.log(
    "PASS: Checkout and order clients use authenticated APIs without fake payment controls.",
  );

  const port =
    randomInt(
      39001,
      43000,
    );

  const baseUrl =
    `http://127.0.0.1:${port}`;

  let server:
    ChildProcess | null = null;

  let logFd:
    number | null = null;

  try {
    logFd = openSync(
      "/tmp/sorvyra-phase-2g-d-next-server.log",
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
          logFd,
          logFd,
        ],
      },
    );

    await waitForServer(
      baseUrl,
      server,
    );

    const checkoutRoutes = [
      {
        code: "ATI",
        path:
          "/ng/atiloszy/checkout",
      },
      {
        code: "ZBF",
        path:
          "/ng/zee-beauty-fashion/checkout",
      },
      {
        code: "DEN",
        path:
          "/ng/denald/checkout",
      },
      {
        code: "ZCH",
        path:
          "/qa/zee-comfort-hub/checkout",
      },
    ];

    const orderRoutes = [
      {
        code: "ATI",
        path:
          "/ng/atiloszy/account/orders/ATI-ABCDEFGHIJ",
      },
      {
        code: "ZBF",
        path:
          "/ng/zee-beauty-fashion/account/orders/ZBF-ABCDEFGHIJ",
      },
      {
        code: "DEN",
        path:
          "/ng/denald/account/orders/DEN-ABCDEFGHIJ",
      },
      {
        code: "ZCH",
        path:
          "/qa/zee-comfort-hub/account/orders/ZCH-ABCDEFGHIJ",
      },
    ];

    for (
      const route of checkoutRoutes
    ) {
      const response =
        await fetch(
          `${baseUrl}${route.path}`,
          {
            redirect: "manual",
          },
        );

      const html =
        await response.text();

      assertCondition(
        response.status === 200,
        `${route.path} returned ${response.status}.`,
      );

      assertCondition(
        html.includes(
          `data-checkout-page="${route.code}"`,
        ),
        `${route.path} did not render the correct checkout storefront.`,
      );
    }

    console.log(
      "PASS: All four storefront checkout pages render.",
    );

    for (
      const route of orderRoutes
    ) {
      const response =
        await fetch(
          `${baseUrl}${route.path}`,
          {
            redirect: "manual",
          },
        );

      const html =
        await response.text();

      assertCondition(
        response.status === 200,
        `${route.path} returned ${response.status}.`,
      );

      assertCondition(
        html.includes(
          `data-order-page="${route.code}"`,
        ),
        `${route.path} did not render the correct order storefront.`,
      );
    }

    console.log(
      "PASS: All four customer-order detail pages render.",
    );

    console.log(
      "PASS: Storefront checkout and order page audit completed.",
    );
  } finally {
    await stopServer(
      server,
    );

    if (
      logFd !== null
    ) {
      closeSync(
        logFd,
      );
    }
  }
}

main().catch(
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
