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

import { prisma } from "../src/lib/prisma";
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

    if (
      server.exitCode !== null ||
      server.signalCode !== null
    ) {
      finish(true);
    }
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
    "=== CUSTOMER AUTHENTICATION PAGE AUDIT ===",
  );

  const tokenSecret =
    process.env.AUTH_TOKEN_SECRET;

  assertCondition(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const suffix = randomBytes(8)
    .toString("hex");

  const email =
    `auth-pages-${suffix}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phoneSuffix =
    `${Date.now()}`.slice(-7);

  const phone =
    `+234703${phoneSuffix}`;

  const password =
    `Auth-Pages-Passphrase-${suffix}`;

  const registration =
    await registerCustomer({
      storefrontCode: "ATI",
      email,
      phone,
      password,
      firstName: "Account",
      lastName: "Page Audit",
      displayName: "Page Audit",
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

  const port = randomInt(
    39001,
    45000,
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
        AUTH_REGISTRATION_API_ENABLED:
          "false",
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
    ).slice(-16000);
  };

  server.stdout.on(
    "data",
    captureLogs,
  );

  server.stderr.on(
    "data",
    captureLogs,
  );

  async function fetchPage(
    path: string,
    cookie?: string,
  ): Promise<Response> {
    return fetch(
      `${baseUrl}${path}`,
      {
        headers: cookie
          ? {
              Cookie: cookie,
            }
          : undefined,
        redirect: "manual",
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

    const portalResponse =
      await fetchPage("/account");

    const portalHtml =
      await portalResponse.text();

    assertCondition(
      portalResponse.status === 200,
      "The global account portal did not load.",
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
        portalHtml.includes(
          `data-portal-storefront="${code}"`,
        ),
        `The account portal is missing ${code}.`,
      );
    }

    console.log(
      "PASS: Global storefront account portal completed.",
    );

    const storefrontPages = [
      {
        code: "ATI",
        base:
          "/ng/atiloszy/account",
      },
      {
        code: "ZBF",
        base:
          "/ng/zee-beauty-fashion/account",
      },
      {
        code: "DEN",
        base:
          "/ng/denald/account",
      },
      {
        code: "ZCH",
        base:
          "/qa/zee-comfort-hub/account",
      },
    ];

    for (
      const storefront of storefrontPages
    ) {
      for (
        const suffixPath of [
          "/login",
          "/register",
          "/verify",
        ]
      ) {
        const response =
          await fetchPage(
            storefront.base +
              suffixPath,
          );

        const html =
          await response.text();

        assertCondition(
          response.status === 200,
          `${storefront.code} ${suffixPath} did not load.`,
        );

        assertCondition(
          html.includes(
            `data-auth-storefront="${storefront.code}"`,
          ),
          `${storefront.code} branding was not rendered.`,
        );
      }
    }

    console.log(
      "PASS: All storefront authentication pages rendered.",
    );

    const unauthenticatedAccount =
      await fetchPage(
        "/ng/atiloszy/account",
      );

    assertCondition(
      (
        unauthenticatedAccount.status ===
          307 ||
        unauthenticatedAccount.status ===
          308
      ),
      "The protected account page did not redirect.",
    );

    const unauthenticatedLocation =
      unauthenticatedAccount.headers.get(
        "location",
      );

    assertCondition(
      unauthenticatedLocation?.includes(
        "/ng/atiloszy/account/login",
      ),
      "The protected page redirected to the wrong login page.",
    );

    console.log(
      "PASS: Unauthenticated account access redirects safely.",
    );

    const loginResponse = await fetch(
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
          password,
        }),
        redirect: "manual",
      },
    );

    assertCondition(
      loginResponse.status === 200,
      "The audit customer could not sign in.",
    );

    const setCookie =
      loginResponse.headers.get(
        "set-cookie",
      );

    assertCondition(
      setCookie,
      "The login response did not set a cookie.",
    );

    const cookiePair =
      setCookie.split(";")[0];

    const authenticatedAccount =
      await fetchPage(
        "/ng/atiloszy/account",
        cookiePair,
      );

    const authenticatedHtml =
      await authenticatedAccount.text();

    assertCondition(
      authenticatedAccount.status === 200,
      "The authenticated account page did not load.",
    );

    assertCondition(
      authenticatedHtml.includes(
        'data-account-storefront="ATI"',
      ),
      "The protected account panel was not rendered.",
    );

    assertCondition(
      authenticatedHtml.includes(
        normalizedEmail,
      ),
      "The protected page did not render the customer identity.",
    );

    assertCondition(
      !authenticatedHtml.includes(
        cookiePair.split("=")[1],
      ),
      "The account page exposed its raw session token.",
    );

    console.log(
      "PASS: Verified customer account page rendered securely.",
    );

    const crossStoreAccount =
      await fetchPage(
        "/ng/zee-beauty-fashion/account",
        cookiePair,
      );

    assertCondition(
      (
        crossStoreAccount.status ===
          307 ||
        crossStoreAccount.status ===
          308
      ),
      "An ATILOSZY cookie accessed another storefront account.",
    );

    const crossStoreLocation =
      crossStoreAccount.headers.get(
        "location",
      );

    assertCondition(
      crossStoreLocation?.includes(
        "/ng/zee-beauty-fashion/account/login",
      ),
      "Cross-store access did not redirect to the correct login.",
    );

    console.log(
      "PASS: Protected account pages remain storefront-isolated.",
    );

    const logoutResponse = await fetch(
      `${baseUrl}/api/auth/logout`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Origin: baseUrl,
          Cookie: cookiePair,
        },
        body: JSON.stringify({
          storefrontCode: "ATI",
        }),
        redirect: "manual",
      },
    );

    assertCondition(
      logoutResponse.status === 200,
      "Logout failed during the page audit.",
    );

    const afterLogout =
      await fetchPage(
        "/ng/atiloszy/account",
        cookiePair,
      );

    assertCondition(
      (
        afterLogout.status === 307 ||
        afterLogout.status === 308
      ),
      "A revoked cookie still accessed the account page.",
    );

    console.log(
      "PASS: Logout revokes protected page access.",
    );

    console.log(
      "PASS: Customer authentication page audit completed.",
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

    await prisma.customerAccount.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    console.log(
      "PASS: Temporary authentication page audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
