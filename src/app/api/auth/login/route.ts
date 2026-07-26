import type {
  NextRequest,
} from "next/server";

import {
  loginCustomer,
} from "../../../../server/auth";
import {
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  getAuthTokenSecret,
  getClientIp,
  getUserAgent,
  readJsonObject,
  requiredString,
  setSessionCookie,
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

    const result =
      await loginCustomer({
        storefrontCode,
        email: requiredString(
          body,
          "email",
          {
            maxLength: 254,
          },
        ),
        password: requiredString(
          body,
          "password",
          {
            maxLength: 1024,
            trim: false,
          },
        ),
        tokenSecret:
          getAuthTokenSecret(),
        ipAddress:
          getClientIp(request),
        userAgent:
          getUserAgent(request),
      });

    const response =
      authJsonResponse({
        ok: true,
        data: {
          user: result.user,
          session: {
            expiresAt:
              result.session.expiresAt
                .toISOString(),
          },
        },
      });

    setSessionCookie(
      response,
      storefrontCode,
      result.sessionToken,
      result.session.expiresAt,
    );

    return response;
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
