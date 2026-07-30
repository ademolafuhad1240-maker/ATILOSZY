import type {
  NextRequest,
} from "next/server";

import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  submitManagerApplication,
} from "@/server/governance";
import {
  assertOnlyFields,
  governanceApiErrorResponse,
  governanceJsonResponse,
  governanceSessionRequiredResponse,
  readGovernanceSession,
  requireStorefrontCode,
  requireStringField,
} from "@/server/governance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(
        request,
      );
    assertOnlyFields(body, [
      "storefrontCode",
      "statement",
    ]);

    const storefrontCode =
      requireStorefrontCode(
        body.storefrontCode,
      );
    const session =
      await readGovernanceSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return governanceSessionRequiredResponse();
    }

    const application =
      await submitManagerApplication({
        storefrontCode,
        userId: session.userId,
        statement:
          requireStringField(
            body,
            "statement",
            2000,
          ),
      });

    return governanceJsonResponse(
      {
        ok: true,
        data: {
          application,
        },
      },
      201,
    );
  } catch (error) {
    return governanceApiErrorResponse(
      error,
    );
  }
}
