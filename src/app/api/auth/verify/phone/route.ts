import type {
  NextRequest,
} from "next/server";

import {
  verifyCustomerPhone,
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
      await verifyCustomerPhone({
        storefrontCode:
          requiredString(
            body,
            "storefrontCode",
            {
              maxLength: 12,
            },
          ),
        challengeId:
          requiredString(
            body,
            "challengeId",
            {
              maxLength: 256,
              trim: false,
            },
          ),
        code: requiredString(
          body,
          "code",
          {
            maxLength: 12,
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
