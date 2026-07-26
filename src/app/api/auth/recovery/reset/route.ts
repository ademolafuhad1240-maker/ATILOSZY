import type {
  NextRequest,
} from "next/server";

import {
  resetCustomerPassword,
} from "../../../../../server/auth";
import {
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  clearSessionCookie,
  getAuthTokenSecret,
  readJsonObject,
  requiredString,
} from "../../../../../server/auth/http";

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

    await resetCustomerPassword({
      storefrontCode,
      token: requiredString(
        body,
        "token",
        {
          maxLength: 256,
          trim: false,
        },
      ),
      newPassword:
        requiredString(
          body,
          "newPassword",
          {
            maxLength: 128,
            trim: false,
          },
        ),
      tokenSecret:
        getAuthTokenSecret(),
    });

    const response =
      authJsonResponse({
        ok: true,
        data: {
          passwordReset: true,
        },
      });

    clearSessionCookie(
      response,
      storefrontCode,
    );

    return response;
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
