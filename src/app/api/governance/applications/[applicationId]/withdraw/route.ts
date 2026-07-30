import type {
  NextRequest,
} from "next/server";

import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  withdrawManagerApplication,
} from "@/server/governance";
import {
  assertOnlyFields,
  governanceApiErrorResponse,
  governanceJsonResponse,
  governanceSessionRequiredResponse,
  readGovernanceSession,
  requireStorefrontCode,
} from "@/server/governance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      applicationId: string;
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
      applicationId,
    } = await context.params;
    const application =
      await withdrawManagerApplication({
        storefrontCode,
        userId: session.userId,
        applicationId,
      });

    return governanceJsonResponse({
      ok: true,
      data: {
        application,
      },
    });
  } catch (error) {
    return governanceApiErrorResponse(
      error,
    );
  }
}
