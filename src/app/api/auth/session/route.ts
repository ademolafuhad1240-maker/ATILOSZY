import type {
  NextRequest,
} from "next/server";

import {
  AuthServiceError,
  validateSession,
} from "../../../../server/auth";
import {
  authApiErrorResponse,
  authJsonResponse,
  getAuthTokenSecret,
  readSessionCookie,
} from "../../../../server/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const storefrontCode =
      request.nextUrl.searchParams
        .get("storefrontCode")
        ?.trim();

    if (!storefrontCode) {
      throw new AuthServiceError(
        "VALIDATION_ERROR",
        "A storefront code is required.",
      );
    }

    const sessionToken =
      readSessionCookie(
        request,
        storefrontCode,
      );

    if (!sessionToken) {
      throw new AuthServiceError(
        "SESSION_INVALID",
        "The session is invalid or expired.",
      );
    }

    const session =
      await validateSession({
        storefrontCode,
        sessionToken,
        tokenSecret:
          getAuthTokenSecret(),
      });

    return authJsonResponse({
      ok: true,
      data: {
        session: {
          id: session.sessionId,
          expiresAt:
            session.expiresAt
              .toISOString(),
        },
        user: {
          id: session.userId,
          storefrontId:
            session.storefrontId,
          storefrontCode:
            session.storefrontCode,
          email: session.email,
        },
      },
    });
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
