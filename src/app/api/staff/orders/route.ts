import type {
  NextRequest,
} from "next/server";

import {
  listStaffOrders,
} from "@/server/operations";
import {
  readStaffApiSession,
  requireStaffStorefrontCode,
  staffApiErrorResponse,
  staffJsonResponse,
  staffLimitFromRequest,
  staffQueueFromRequest,
  staffSessionRequiredResponse,
} from "@/server/operations/http";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const storefrontCode =
      requireStaffStorefrontCode(
        request.nextUrl
          .searchParams.get(
            "storefrontCode",
          ),
      );

    const session =
      await readStaffApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return staffSessionRequiredResponse();
    }

    const result =
      await listStaffOrders({
        storefrontCode,
        userId:
          session.userId,
        queue:
          staffQueueFromRequest(
            request,
          ),
        limit:
          staffLimitFromRequest(
            request,
          ),
      });

    return staffJsonResponse({
      ok: true,
      ...result,
    });
  } catch (error) {
    return staffApiErrorResponse(
      error,
    );
  }
}
