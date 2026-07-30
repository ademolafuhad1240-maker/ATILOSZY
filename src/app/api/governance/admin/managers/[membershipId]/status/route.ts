import type {
  NextRequest,
} from "next/server";

import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  manageManagerStatus,
} from "@/server/governance";
import {
  assertOnlyFields,
  governanceApiErrorResponse,
  governanceJsonResponse,
  governanceSessionRequiredResponse,
  optionalStringField,
  readGovernanceSession,
  requireManagerAction,
  requireStorefrontCode,
} from "@/server/governance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      membershipId: string;
    }>;
  },
) {
  try {
    assertTrustedOrigin(request);
    const body =
      await readJsonObject(
        request,
      );
    assertOnlyFields(body, [
      "storefrontCode",
      "action",
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

    const {
      membershipId,
    } = await context.params;
    const manager =
      await manageManagerStatus({
        administratorUserId:
          session.userId,
        membershipId,
        action:
          requireManagerAction(
            body.action,
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
        manager,
      },
    });
  } catch (error) {
    return governanceApiErrorResponse(
      error,
    );
  }
}
