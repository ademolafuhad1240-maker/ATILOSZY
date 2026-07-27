import "server-only";

import {
  PaymentServiceError,
} from "../errors";
import type {
  ProcessProductPaymentEventInput,
} from "../types";
import {
  isPaymentWebhookError,
  PaymentWebhookError,
} from "./errors";
import type {
  PaymentWebhookProvider,
} from "./types";

const maximumWebhookBodyLength =
  1_000_000;

export type PaymentWebhookProcessor =
  (
    input:
      ProcessProductPaymentEventInput,
  ) => Promise<unknown>;

async function processPaymentWebhookEvent(
  input:
    ProcessProductPaymentEventInput,
): Promise<unknown> {
  const {
    processProductPaymentEvent,
  } =
    await import(
      "../service"
    );

  return processProductPaymentEvent(
    input,
  );
}

function webhookResponse(
  status: number,
): Response {
  return new Response(
    null,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
        "Content-Length":
          "0",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

async function readRawWebhookBody(
  request: Request,
): Promise<{
  rawBody: Uint8Array;
  rawText: string;
}> {
  const contentType =
    request.headers
      .get(
        "content-type",
      )
      ?.split(
        ";",
      )[0]
      ?.trim()
      .toLowerCase();

  if (
    contentType !==
      "application/json"
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_CONTENT_TYPE_REQUIRED",
      "The webhook request must contain JSON.",
      415,
    );
  }

  const contentLength =
    request.headers.get(
      "content-length",
    );

  if (
    contentLength !== null &&
    Number(
      contentLength,
    ) >
      maximumWebhookBodyLength
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_BODY_TOO_LARGE",
      "The webhook request body is too large.",
      413,
    );
  }

  const rawBody =
    new Uint8Array(
      await request
        .arrayBuffer(),
    );

  if (
    rawBody.byteLength ===
      0 ||
    rawBody.byteLength >
      maximumWebhookBodyLength
  ) {
    throw new PaymentWebhookError(
      rawBody.byteLength ===
          0
        ? "WEBHOOK_BODY_INVALID"
        : "WEBHOOK_BODY_TOO_LARGE",
      rawBody.byteLength ===
          0
        ? "The webhook request body is invalid."
        : "The webhook request body is too large.",
      rawBody.byteLength ===
          0
        ? 400
        : 413,
    );
  }

  let rawText: string;

  try {
    rawText =
      new TextDecoder(
        "utf-8",
        {
          fatal: true,
        },
      ).decode(
        rawBody,
      );
  } catch {
    throw new PaymentWebhookError(
      "WEBHOOK_BODY_INVALID",
      "The webhook request body is invalid.",
      400,
    );
  }

  return {
    rawBody,
    rawText,
  };
}

function webhookErrorResponse(
  error: unknown,
): Response {
  if (
    isPaymentWebhookError(
      error,
    )
  ) {
    return webhookResponse(
      error.status,
    );
  }

  if (
    error instanceof
      PaymentServiceError &&
    error.code ===
      "EVENT_PAYLOAD_CONFLICT"
  ) {
    return webhookResponse(
      409,
    );
  }

  console.error(
    "Payment webhook processing failed.",
    {
      errorName:
        error instanceof Error
          ? error.name
          : "UnknownError",
    },
  );

  return webhookResponse(
    500,
  );
}

export async function handlePaymentWebhook(
  request: Request,
  resolveProvider:
    () => PaymentWebhookProvider,
  processEvent:
    PaymentWebhookProcessor =
      processPaymentWebhookEvent,
): Promise<Response> {
  try {
    const provider =
      resolveProvider();

    const {
      rawBody,
      rawText,
    } =
      await readRawWebhookBody(
        request,
      );

    const normalized =
      await provider.normalize({
        rawBody,
        rawText,
        signature:
          request.headers.get(
            provider
              .signatureHeader,
          ),
      });

    if (
      normalized.kind ===
        "IGNORED"
    ) {
      return webhookResponse(
        200,
      );
    }

    await processEvent({
      provider:
        provider.name,
      ...normalized.event,
      signatureVerified:
        true,
    });

    return webhookResponse(
      200,
    );
  } catch (error) {
    return webhookErrorResponse(
      error,
    );
  }
}
