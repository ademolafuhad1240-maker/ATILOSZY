import type {
  NextRequest,
} from "next/server";

import {
  revokeSessionToken,
} from "@/server/auth";
import {
  assertTrustedOrigin,
  authJsonResponse,
  clearPlatformSessionCookie,
  getAuthTokenSecret,
  readJsonObject,
  readPlatformSessionCookie,
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
    assertOnlyFields(body, []);

    const sessionToken =
      readPlatformSessionCookie(
        request,
      );

    if (sessionToken) {
      await revokeSessionToken({
        sessionToken,
        tokenSecret:
          getAuthTokenSecret(),
        reason:
          "PLATFORM_ADMINISTRATOR_LOGOUT",
      });
    }

    const response =
      authJsonResponse({
        ok: true,
        data: {
          loggedOut: true,
        },
      });

    clearPlatformSessionCookie(
      response,
    );

    return response;
  } catch (error) {
    return governanceApiErrorResponse(
      error,
    );
  }
}
