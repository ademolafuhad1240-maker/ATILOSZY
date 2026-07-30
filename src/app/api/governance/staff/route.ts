import type {
  NextRequest,
} from "next/server";

import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  manageStorefrontStaff,
} from "@/server/governance";
import {
  assertOnlyFields,
  governanceApiErrorResponse,
  governanceJsonResponse,
  governanceSessionRequiredResponse,
  optionalStringField,
  readGovernanceSession,
  requireStaffAction,
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
      "targetEmail",
      "action",
      "role",
      "note",
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

    const membership =
      await manageStorefrontStaff({
        storefrontCode,
        managerUserId:
          session.userId,
        targetEmail:
          requireStringField(
            body,
            "targetEmail",
            254,
          ),
        action:
          requireStaffAction(
            body.action,
          ),
        role:
          optionalStringField(
            body,
            "role",
            32,
          ),
        note:
          optionalStringField(
            body,
            "note",
            500,
          ),
      });

    return governanceJsonResponse({
      ok: true,
      data: {
        membership,
      },
    });
  } catch (error) {
    return governanceApiErrorResponse(
      error,
    );
  }
}
