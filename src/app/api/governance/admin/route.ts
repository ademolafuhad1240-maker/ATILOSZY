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
  readPlatformGovernanceSession,
} from "@/server/governance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const session =
      await readPlatformGovernanceSession(
        request,
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
