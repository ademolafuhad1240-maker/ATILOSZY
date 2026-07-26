import type {
  NextRequest,
} from "next/server";

import {
  registerCustomer,
} from "../../../../server/auth";
import {
  assertRegistrationApiEnabled,
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  getAuthTokenSecret,
  optionalBoolean,
  optionalString,
  readJsonObject,
  requiredBoolean,
  requiredString,
} from "../../../../server/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);
    assertRegistrationApiEnabled();

    const body =
      await readJsonObject(request);

    const result =
      await registerCustomer({
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
        phone: requiredString(
          body,
          "phone",
          {
            maxLength: 32,
          },
        ),
        password: requiredString(
          body,
          "password",
          {
            maxLength: 128,
            trim: false,
          },
        ),
        firstName: requiredString(
          body,
          "firstName",
          {
            maxLength: 100,
          },
        ),
        lastName: requiredString(
          body,
          "lastName",
          {
            maxLength: 100,
          },
        ),
        displayName: optionalString(
          body,
          "displayName",
          {
            maxLength: 100,
          },
        ),
        marketingOptIn:
          optionalBoolean(
            body,
            "marketingOptIn",
          ),
        termsAccepted:
          requiredBoolean(
            body,
            "termsAccepted",
          ),
        privacyAccepted:
          requiredBoolean(
            body,
            "privacyAccepted",
          ),
        tokenSecret:
          getAuthTokenSecret(),
      });

    return authJsonResponse(
      {
        ok: true,
        data: {
          user: {
            id: result.user.id,
            status:
              result.user.status,
          },
          verification: {
            emailRequired: true,
            phoneRequired: true,
            delivery:
              "PENDING_PROVIDER_INTEGRATION",
          },
        },
      },
      201,
    );
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
