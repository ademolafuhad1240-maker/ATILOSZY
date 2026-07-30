import {
  type ChildProcessByStdio,
  spawn,
} from "node:child_process";
import type { Readable } from "node:stream";
import {
  randomBytes,
  randomInt,
} from "node:crypto";

import { prisma } from "../src/lib/prisma";
import {
  normalizeEmail,
  registerCustomer,
} from "../src/server/auth";

interface HttpResult {
  status: number;
  json: unknown;
  text: string;
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

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function responseContainsKey(
  value: unknown,
  key: string,
): boolean {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) =>
      responseContainsKey(item, key),
    );
  }

  const record =
    value as Record<string, unknown>;

  if (
    Object.prototype.hasOwnProperty.call(
      record,
      key,
    )
  ) {
    return true;
  }

  return Object.values(record).some(
    (item) =>
      responseContainsKey(item, key),
  );
}

async function waitForServerExit(
  server: ChildProcessByStdio<null, Readable, Readable>,
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
  server: ChildProcessByStdio<null, Readable, Readable>,
): Promise<void> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return;
  }

  server.kill("SIGTERM");

  const terminated =
    await waitForServerExit(
      server,
      5000,
    );

  if (terminated) {
    return;
  }

  server.kill("SIGKILL");

  const killed =
    await waitForServerExit(
      server,
      2000,
    );

  if (!killed) {
    console.warn(
      "The temporary Next.js process did not confirm shutdown.",
    );
  }
}

async function main(): Promise<void> {
  console.log(
    "=== AUTHENTICATION API ROUTE AUDIT ===",
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

  const routeEmail =
    `api-route-${suffix}@example.test`;

  const serviceEmail =
    `api-service-${suffix}@example.test`;

  const normalizedEmails = [
    normalizeEmail(routeEmail),
    normalizeEmail(serviceEmail),
  ];

  const phoneSuffix =
    `${Date.now()}`.slice(-7);

  const routePhone =
    `+234701${phoneSuffix}`;

  const servicePhone =
    `+234702${phoneSuffix}`;

  const password =
    `API-Audit-Passphrase-${suffix}`;

  const port = randomInt(
    32000,
    39000,
  );

  const baseUrl =
    `http://127.0.0.1:${port}`;

  let server:
    | ChildProcessByStdio<null, Readable, Readable>
    | null = null;

  let serverLogs = "";

  const appendLogs = (
    chunk: Buffer,
  ): void => {
    serverLogs = (
      serverLogs +
      chunk.toString("utf8")
    ).slice(-16000);
  };

  const requestJson = async (
    method: string,
    path: string,
    body?: unknown,
    cookie?: string,
    origin?: string,
  ): Promise<HttpResult> => {
    const headers:
      Record<string, string> = {
        Accept: "application/json",
      };

    if (body !== undefined) {
      headers["Content-Type"] =
        "application/json";
    }

    if (cookie) {
      headers.Cookie = cookie;
    }

    if (origin) {
      headers.Origin = origin;
    }

    const response = await fetch(
      `${baseUrl}${path}`,
      {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body),
        redirect: "manual",
      },
    );

    const text = await response.text();

    let json: unknown = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          `Expected JSON from ${path}, received: ${text.slice(0, 200)}`,
        );
      }
    }

    return {
      status: response.status,
      json,
      text,
      setCookie:
        response.headers.get(
          "set-cookie",
        ),
    };
  };

  try {
    const registration =
      await registerCustomer({
        storefrontCode: "ATI",
        email: serviceEmail,
        phone: servicePhone,
        password,
        firstName: "API",
        lastName: "Audit",
        termsAccepted: true,
        privacyAccepted: true,
        marketingOptIn: false,
        tokenSecret,
      });

    server = spawn(
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
            "true",
          AUTH_DELIVERY_PROVIDER:
            "disabled",
        },
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      },
    );

    server.stdout.on(
      "data",
      appendLogs,
    );

    server.stderr.on(
      "data",
      appendLogs,
    );

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
        const response = await fetch(
          baseUrl,
        );

        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // The server is still starting.
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

    const crossOrigin =
      await requestJson(
        "POST",
        "/api/auth/login",
        {
          storefrontCode: "ATI",
          email: serviceEmail,
          password,
        },
        undefined,
        "https://untrusted.example",
      );

    assertCondition(
      crossOrigin.status === 403,
      "A cross-origin authentication request was accepted.",
    );

    console.log(
      "PASS: Cross-origin authentication requests are rejected.",
    );

    const routeRegistration =
      await requestJson(
        "POST",
        "/api/auth/register",
        {
          storefrontCode: "ATI",
          email: routeEmail,
          phone: routePhone,
          password,
          firstName: "Route",
          lastName: "Audit",
          marketingOptIn: false,
          termsAccepted: true,
          privacyAccepted: true,
        },
        undefined,
        baseUrl,
      );

    assertCondition(
      routeRegistration.status ===
        503,
      "Registration did not fail closed while delivery was disabled.",
    );

    for (
      const forbiddenKey of [
        "emailVerificationToken",
        "phoneVerificationCode",
        "phoneChallengeId",
        "sessionToken",
        "password",
        "passwordHash",
        "tokenHash",
        "codeHash",
      ]
    ) {
      assertCondition(
        !responseContainsKey(
          routeRegistration.json,
          forbiddenKey,
        ),
        `The registration response exposed ${forbiddenKey}.`,
      );
    }

    assertCondition(
      routeRegistration.text.includes(
        "AUTH_DELIVERY_UNAVAILABLE",
      ),
      "Disabled registration did not return the safe delivery error.",
    );

    const blockedRegistrationUser =
      await prisma.user.findFirst({
        where: {
          normalizedEmail:
            normalizeEmail(
              routeEmail,
            ),
        },
        select: {
          id: true,
        },
      });

    assertCondition(
      blockedRegistrationUser ===
        null,
      "Registration created an unreachable account while delivery was disabled.",
    );

    console.log(
      "PASS: Registration fails closed before creating an account when delivery is disabled.",
    );

    const loginBeforeVerification =
      await requestJson(
        "POST",
        "/api/auth/login",
        {
          storefrontCode: "ATI",
          email: serviceEmail,
          password,
        },
        undefined,
        baseUrl,
      );

    assertCondition(
      loginBeforeVerification.status ===
        403,
      "An unverified account logged in through the API.",
    );

    console.log(
      "PASS: HTTP login is blocked before both verifications.",
    );

    const emailVerification =
      await requestJson(
        "POST",
        "/api/auth/verify/email",
        {
          storefrontCode: "ATI",
          token:
            registration
              .emailVerificationToken,
        },
        undefined,
        baseUrl,
      );

    assertCondition(
      emailVerification.status === 200,
      "Email verification route failed.",
    );

    const phoneVerification =
      await requestJson(
        "POST",
        "/api/auth/verify/phone",
        {
          storefrontCode: "ATI",
          challengeId:
            registration
              .phoneChallengeId,
          code:
            registration
              .phoneVerificationCode,
        },
        undefined,
        baseUrl,
      );

    assertCondition(
      phoneVerification.status === 200,
      "Phone verification route failed.",
    );

    assertCondition(
      !responseContainsKey(
        emailVerification.json,
        "token",
      ),
      "Email verification response exposed a token.",
    );

    assertCondition(
      !responseContainsKey(
        phoneVerification.json,
        "code",
      ),
      "Phone verification response exposed a code.",
    );

    console.log(
      "PASS: Email and phone verification routes completed safely.",
    );

    const login =
      await requestJson(
        "POST",
        "/api/auth/login",
        {
          storefrontCode: "ATI",
          email: serviceEmail,
          password,
        },
        undefined,
        baseUrl,
      );

    assertCondition(
      login.status === 200,
      "Verified API login failed.",
    );

    assertCondition(
      login.setCookie,
      "Login did not set a session cookie.",
    );

    assertCondition(
      !responseContainsKey(
        login.json,
        "sessionToken",
      ),
      "Login exposed the raw session token in JSON.",
    );

    const lowerCookie =
      login.setCookie.toLowerCase();

    assertCondition(
      lowerCookie.includes("httponly"),
      "The session cookie is not HttpOnly.",
    );

    assertCondition(
      lowerCookie.includes(
        "samesite=lax",
      ),
      "The session cookie does not use SameSite=Lax.",
    );

    assertCondition(
      lowerCookie.includes("path=/"),
      "The session cookie is not scoped to the root path.",
    );

    const cookiePair =
      login.setCookie.split(";")[0];

    assertCondition(
      cookiePair.startsWith(
        "sorvyra_session_ati=",
      ),
      "The local storefront cookie name is invalid.",
    );

    console.log(
      "PASS: Login sets a protected storefront-specific cookie.",
    );

    const currentSession =
      await requestJson(
        "GET",
        "/api/auth/session?storefrontCode=ATI",
        undefined,
        cookiePair,
      );

    assertCondition(
      currentSession.status === 200,
      "The current-session route rejected a valid cookie.",
    );

    assertCondition(
      !responseContainsKey(
        currentSession.json,
        "sessionToken",
      ),
      "The current-session response exposed a raw token.",
    );

    console.log(
      "PASS: Current-session route validated the protected cookie.",
    );

    const wrongStoreSession =
      await requestJson(
        "GET",
        "/api/auth/session?storefrontCode=ZBF",
        undefined,
        cookiePair,
      );

    assertCondition(
      wrongStoreSession.status === 401,
      "A session cookie crossed storefront boundaries.",
    );

    console.log(
      "PASS: Session cookies remain isolated by storefront.",
    );

    const logout =
      await requestJson(
        "POST",
        "/api/auth/logout",
        {
          storefrontCode: "ATI",
        },
        cookiePair,
        baseUrl,
      );

    assertCondition(
      logout.status === 200,
      "Logout route failed.",
    );

    assertCondition(
      logout.setCookie,
      "Logout did not clear the session cookie.",
    );

    const lowerLogoutCookie =
      logout.setCookie.toLowerCase();

    assertCondition(
      lowerLogoutCookie.includes(
        "max-age=0",
      ) ||
        lowerLogoutCookie.includes(
          "expires=thu, 01 jan 1970",
        ),
      "Logout did not expire the session cookie.",
    );

    const revokedSession =
      await requestJson(
        "GET",
        "/api/auth/session?storefrontCode=ATI",
        undefined,
        cookiePair,
      );

    assertCondition(
      revokedSession.status === 401,
      "The logged-out session remained valid.",
    );

    console.log(
      "PASS: Logout clears and revokes the active session.",
    );

    console.log(
      "PASS: Authentication API route audit completed.",
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
    await prisma.user.deleteMany({
      where: {
        normalizedEmail: {
          in: normalizedEmails,
        },
      },
    });

    console.log(
      "PASS: Temporary authentication API audit records removed.",
    );

    if (server) {
      await stopServer(server);
    }

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
