import type {
  NextRequest,
} from "next/server";

import {
  getAdminGovernanceView,
} from "@/server/governance";
import {
  governanceApiErrorResponse,
  governanceJsonResponse,
  governanceSessionRequiredResponse,
  readGovernanceSession,
  requireStorefrontCode,
} from "@/server/governance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const storefrontCode =
      requireStorefrontCode(
        request.nextUrl
          .searchParams.get(
            "storefrontCode",
          ),
      );
    const session =
      await readGovernanceSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return governanceSessionRequiredResponse();
    }

    const view =
      await getAdminGovernanceView({
        userId: session.userId,
      });

    return governanceJsonResponse({
      ok: true,
      data: view,
    });
  } catch (error) {
    return governanceApiErrorResponse(
      error,
    );
  }
}
