import type {
  NextRequest,
} from "next/server";

import {
  loginPlatformAdministrator,
} from "@/server/auth";
import {
  assertTrustedOrigin,
  authJsonResponse,
  getAuthTokenSecret,
  getClientIp,
  getUserAgent,
  readJsonObject,
  requiredString,
  setPlatformSessionCookie,
} from "@/server/auth/http";
import {
  assertOnlyFields,
  governanceApiErrorResponse,
} from "@/server/governance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);
    const body =
      await readJsonObject(request);

    assertOnlyFields(body, [
      "email",
      "password",
    ]);

    const result =
      await loginPlatformAdministrator({
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
          administrator:
            result.administrator,
          session: {
            expiresAt:
              result.session.expiresAt
                .toISOString(),
          },
        },
      });

    setPlatformSessionCookie(
      response,
      result.sessionToken,
      result.session.expiresAt,
    );

    return response;
  } catch (error) {
    return governanceApiErrorResponse(
      error,
    );
  }
}
