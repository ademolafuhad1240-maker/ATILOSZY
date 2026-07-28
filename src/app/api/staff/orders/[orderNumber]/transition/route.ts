import type {
  NextRequest,
} from "next/server";

import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  transitionStaffOrder,
} from "@/server/operations";
import {
  optionalStaffNote,
  readStaffApiSession,
  requireStaffAction,
  requireStaffStorefrontCode,
  requireTransitionFields,
  staffApiErrorResponse,
  staffJsonResponse,
  staffSessionRequiredResponse,
} from "@/server/operations/http";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

interface RouteContext {
  params: Promise<{
    orderNumber: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    assertTrustedOrigin(
      request,
    );

    const body =
      await readJsonObject(
        request,
      );

    requireTransitionFields(
      body,
    );

    const storefrontCode =
      requireStaffStorefrontCode(
        body.storefrontCode,
      );

    const session =
      await readStaffApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return staffSessionRequiredResponse();
    }

    const {
      orderNumber,
    } = await context.params;

    const result =
      await transitionStaffOrder({
        storefrontCode,
        userId:
          session.userId,
        orderNumber,
        action:
          requireStaffAction(
            body.action,
          ),
        note:
          optionalStaffNote(
            body.note,
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
