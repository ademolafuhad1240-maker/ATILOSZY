import type {
  NextRequest,
} from "next/server";

import {
  verifyCustomerEmail,
} from "../../../../../server/auth";
import {
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
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

    const result =
      await verifyCustomerEmail({
        storefrontCode:
          requiredString(
            body,
            "storefrontCode",
            {
              maxLength: 12,
            },
          ),
        token: requiredString(
          body,
          "token",
          {
            maxLength: 256,
            trim: false,
          },
        ),
        tokenSecret:
          getAuthTokenSecret(),
      });

    return authJsonResponse({
      ok: true,
      data: result,
    });
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
