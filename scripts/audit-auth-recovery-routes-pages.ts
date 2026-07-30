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
  type AuthDeliveryProvider,
  type EmailVerificationDelivery,
  type PasswordResetDelivery,
  type PhoneVerificationDelivery,
  normalizeEmail,
  registerCustomer,
  requestPasswordReset,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";

type TestServer =
  ChildProcessByStdio<
    null,
    Readable,
    Readable
  >;

class CaptureDeliveryProvider
  implements AuthDeliveryProvider {
  readonly name = "recovery-http-audit";
  readonly enabled = true;
  readonly phoneVerificationEnabled =
    true;

  readonly passwordResets:
    PasswordResetDelivery[] = [];

  async sendEmailVerification(
    _delivery:
      EmailVerificationDelivery,
  ): Promise<void> {}

  async sendPhoneVerification(
    _delivery:
      PhoneVerificationDelivery,
  ): Promise<void> {}

  async sendPasswordReset(
    delivery:
      PasswordResetDelivery,
  ): Promise<void> {
    this.passwordResets.push(
      delivery,
    );
  }
}

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
      responseContainsKey(
        item,
        key,
      ),
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
      responseContainsKey(
        item,
        key,
      ),
  );
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
    "=== AUTHENTICATION RECOVERY ROUTE AND PAGE AUDIT ===",
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
    `recovery-http-${suffix}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phoneSuffix =
    `${Date.now()}`.slice(-7);

  const phone =
    `+234705${phoneSuffix}`;

  const oldPassword =
    `Old-HTTP-Recovery-${suffix}`;

  const newPassword =
    `New-HTTP-Recovery-${suffix}`;

  const registration =
    await registerCustomer({
      storefrontCode: "ATI",
      email,
      phone,
      password: oldPassword,
      firstName: "Recovery",
      lastName: "HTTP Audit",
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

  const capture =
    new CaptureDeliveryProvider();

  await requestPasswordReset(
    {
      storefrontCode: "ATI",
      email,
      tokenSecret,
    },
    capture,
  );

  assertCondition(
    capture.passwordResets.length === 1,
    "The audit password-reset token was not created.",
  );

  const resetToken =
    capture.passwordResets[0].token;

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

  async function requestJson(
    method: string,
    path: string,
    body?: unknown,
    cookie?: string,
  ): Promise<HttpResult> {
    const headers:
      Record<string, string> = {
        Accept: "application/json",
      };

    if (body !== undefined) {
      headers["Content-Type"] =
        "application/json";

      headers.Origin = baseUrl;
    }

    if (cookie) {
      headers.Cookie = cookie;
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

    const text =
      await response.text();

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
        // The production server is still starting.
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
          "/forgot-password",
          "/reset-password",
        ]
      ) {
        const response = await fetch(
          `${baseUrl}${storefront.base}${suffixPath}`,
          {
            redirect: "manual",
          },
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
          `${storefront.code} recovery branding was not rendered.`,
        );
      }
    }

    console.log(
      "PASS: All storefront recovery pages rendered.",
    );

    const disabledRecovery =
      await requestJson(
        "POST",
        "/api/auth/recovery/request",
        {
          storefrontCode: "ATI",
          email,
        },
      );

    assertCondition(
      disabledRecovery.status === 503,
      "Disabled recovery delivery did not return 503.",
    );

    assertCondition(
      responseContainsKey(
        disabledRecovery.json,
        "error",
      ),
      "Disabled recovery did not return a safe error response.",
    );

    assertCondition(
      !disabledRecovery.text.includes(
        email,
      ),
      "The recovery response exposed the submitted email.",
    );

    assertCondition(
      !disabledRecovery.text.includes(
        resetToken,
      ),
      "The recovery response exposed a reset token.",
    );

    console.log(
      "PASS: Provider-disabled recovery requests fail safely.",
    );

    const disabledResend =
      await requestJson(
        "POST",
        "/api/auth/verify/resend",
        {
          storefrontCode: "ATI",
          email,
        },
      );

    assertCondition(
      disabledResend.status === 503,
      "Disabled verification resend did not return 503.",
    );

    assertCondition(
      !disabledResend.text.includes(
        email,
      ),
      "The resend response exposed the submitted email.",
    );

    console.log(
      "PASS: Provider-disabled verification resend fails safely.",
    );

    const invalidReset =
      await requestJson(
        "POST",
        "/api/auth/recovery/reset",
        {
          storefrontCode: "ATI",
          token:
            `${resetToken}-invalid`,
          newPassword,
        },
      );

    assertCondition(
      invalidReset.status === 400,
      "An invalid password-reset token was not rejected.",
    );

    console.log(
      "PASS: Invalid recovery tokens are rejected safely.",
    );

    const login = await requestJson(
      "POST",
      "/api/auth/login",
      {
        storefrontCode: "ATI",
        email,
        password: oldPassword,
      },
    );

    assertCondition(
      login.status === 200,
      "The recovery audit customer could not sign in.",
    );

    assertCondition(
      login.setCookie,
      "Login did not set a session cookie.",
    );

    const cookiePair =
      login.setCookie.split(";")[0];

    const reset = await requestJson(
      "POST",
      "/api/auth/recovery/reset",
      {
        storefrontCode: "ATI",
        token: resetToken,
        newPassword,
      },
      cookiePair,
    );

    assertCondition(
      reset.status === 200,
      "The password-reset route failed.",
    );

    assertCondition(
      reset.setCookie,
      "Password reset did not clear the storefront cookie.",
    );

    assertCondition(
      !responseContainsKey(
        reset.json,
        "token",
      ),
      "The reset response exposed a token.",
    );

    assertCondition(
      !responseContainsKey(
        reset.json,
        "userId",
      ),
      "The reset response exposed an internal user ID.",
    );

    console.log(
      "PASS: Password-reset route completed without exposing secrets.",
    );

    const oldSession =
      await requestJson(
        "GET",
        "/api/auth/session?storefrontCode=ATI",
        undefined,
        cookiePair,
      );

    assertCondition(
      oldSession.status === 401,
      "A pre-reset session remained valid.",
    );

    const oldPasswordLogin =
      await requestJson(
        "POST",
        "/api/auth/login",
        {
          storefrontCode: "ATI",
          email,
          password: oldPassword,
        },
      );

    assertCondition(
      oldPasswordLogin.status === 401,
      "The old password remained valid.",
    );

    const newPasswordLogin =
      await requestJson(
        "POST",
        "/api/auth/login",
        {
          storefrontCode: "ATI",
          email,
          password: newPassword,
        },
      );

    assertCondition(
      newPasswordLogin.status === 200,
      "The new password could not sign in.",
    );

    console.log(
      "PASS: Reset revokes sessions and replaces the password.",
    );

    const reusedReset =
      await requestJson(
        "POST",
        "/api/auth/recovery/reset",
        {
          storefrontCode: "ATI",
          token: resetToken,
          newPassword:
            `${newPassword}-again`,
        },
      );

    assertCondition(
      reusedReset.status === 400,
      "A reset token was accepted more than once.",
    );

    console.log(
      "PASS: HTTP password-reset tokens are single use.",
    );

    console.log(
      "PASS: Authentication recovery route and page audit completed.",
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

    console.log(
      "PASS: Temporary recovery HTTP audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
