import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type {
  ValidatedSession,
} from "./types";
import {
  AuthServiceError,
} from "./errors";
import {
  validateSession,
} from "./session";
import {
  getAuthTokenSecret,
  getSessionCookieName,
} from "./http";

export async function requireStorefrontSession(
  storefrontCode: string,
  loginHref: string,
): Promise<ValidatedSession> {
  const cookieStore = await cookies();

  const sessionToken = cookieStore.get(
    getSessionCookieName(
      storefrontCode,
    ),
  )?.value;

  if (!sessionToken) {
    redirect(loginHref);
  }

  try {
    return await validateSession({
      storefrontCode,
      sessionToken,
      tokenSecret:
        getAuthTokenSecret(),
    });
  } catch (error) {
    if (
      error instanceof AuthServiceError &&
      (
        error.code === "SESSION_INVALID" ||
        error.code ===
          "ACCOUNT_UNAVAILABLE"
      )
    ) {
      redirect(loginHref);
    }

    throw error;
  }
}
