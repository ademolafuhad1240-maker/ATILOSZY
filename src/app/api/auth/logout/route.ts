import type {
  NextRequest,
} from "next/server";

import {
  revokeCustomerAccountSessions,
} from "../../../../server/auth";
import {
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  clearSessionCookie,
  getAuthTokenSecret,
  readJsonObject,
  readSessionCookie,
  requiredString,
} from "../../../../server/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const storefrontCode =
      requiredString(
        body,
        "storefrontCode",
        {
          maxLength: 12,
        },
      );

    const sessionToken =
      readSessionCookie(
        request,
        storefrontCode,
      );

    const storefrontCodes =
      sessionToken
        ? await revokeCustomerAccountSessions({
        sessionToken,
        tokenSecret:
          getAuthTokenSecret(),
        reason: "USER_LOGOUT",
          })
        : [];

    const response =
      authJsonResponse({
        ok: true,
        data: {
          loggedOut: true,
        },
      });

    for (const code of new Set([
      storefrontCode,
      ...storefrontCodes,
    ])) {
      clearSessionCookie(
        response,
        code,
      );
    }

    return response;
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
