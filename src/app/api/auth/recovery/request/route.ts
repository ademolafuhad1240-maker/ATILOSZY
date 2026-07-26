import type {
  NextRequest,
} from "next/server";

import {
  getAuthDeliveryProvider,
  requestPasswordReset,
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

    await requestPasswordReset(
      {
        storefrontCode:
          requiredString(
            body,
            "storefrontCode",
            {
              maxLength: 12,
            },
          ),
        email: requiredString(
          body,
          "email",
          {
            maxLength: 254,
          },
        ),
        tokenSecret:
          getAuthTokenSecret(),
      },
      getAuthDeliveryProvider(),
    );

    return authJsonResponse(
      {
        ok: true,
        data: {
          accepted: true,
        },
      },
      202,
    );
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
