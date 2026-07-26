import {
  randomBytes,
} from "node:crypto";

import {
  PaymentProviderEventStatus,
} from "../src/generated/prisma/client";
import {
  prisma,
} from "../src/lib/prisma";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isPrismaErrorCode(
  error: unknown,
  expectedCode: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === expectedCode
  );
}

async function main(): Promise<void> {
  console.log(
    "=== PROVIDER-NEUTRAL PAYMENT EVENT FOUNDATION AUDIT ===",
  );

  const token =
    randomBytes(10)
      .toString("hex");

  const provider =
    `audit-provider-${token}`;

  const storefront =
    await prisma.storefront.findUnique({
      where: {
        code: "ATI",
      },
      select: {
        id: true,
        code: true,
      },
    });

  assertCondition(
    storefront,
    "ATI storefront was not found.",
  );

  try {
    const received =
      await prisma.paymentProviderEvent.create({
        data: {
          provider,
          providerEventId:
            `evt-received-${token}`,
          eventType:
            "payment.completed",
          status:
            PaymentProviderEventStatus
              .RECEIVED,
          payloadHash:
            `sha256-${token}`,
          payload: {
            event:
              "payment.completed",
            reference:
              `reference-${token}`,
            amount:
              "12500.00",
            currency:
              "NGN",
          },
          signatureVerified:
            true,
          storefrontId:
            storefront.id,
        },
        include: {
          storefront: {
            select: {
              code: true,
            },
          },
          orderPayment: {
            select: {
              id: true,
            },
          },
        },
      });

    assertCondition(
      received.status ===
        PaymentProviderEventStatus
          .RECEIVED,
      "Provider event was not stored as RECEIVED.",
    );

    assertCondition(
      received.signatureVerified,
      "Signature-verification state was not stored.",
    );

    assertCondition(
      received.storefront?.code ===
        "ATI",
      "Provider event was not related to the correct storefront.",
    );

    assertCondition(
      received.orderPayment ===
        null,
      "Uncorrelated provider event unexpectedly has a payment.",
    );

    assertCondition(
      isRecord(
        received.payload,
      ),
      "Provider event payload was not stored as JSON.",
    );

    console.log(
      "PASS: Verified provider event payload and storefront scope were stored.",
    );

    const processing =
      await prisma.paymentProviderEvent.update({
        where: {
          id: received.id,
        },
        data: {
          status:
            PaymentProviderEventStatus
              .PROCESSING,
          processingStartedAt:
            new Date(),
          attemptCount: {
            increment: 1,
          },
        },
      });

    assertCondition(
      processing.status ===
        PaymentProviderEventStatus
          .PROCESSING &&
        processing.attemptCount ===
          1 &&
        processing
          .processingStartedAt !==
          null,
      "Provider event did not enter PROCESSING correctly.",
    );

    const processed =
      await prisma.paymentProviderEvent.update({
        where: {
          id: received.id,
        },
        data: {
          status:
            PaymentProviderEventStatus
              .PROCESSED,
          processedAt:
            new Date(),
          failureCode:
            null,
          failureMessage:
            null,
        },
      });

    assertCondition(
      processed.status ===
        PaymentProviderEventStatus
          .PROCESSED &&
        processed.processedAt !==
          null,
      "Provider event did not enter PROCESSED correctly.",
    );

    console.log(
      "PASS: Provider event supports received, processing and processed states.",
    );

    let duplicateRejected =
      false;

    try {
      await prisma.paymentProviderEvent.create({
        data: {
          provider,
          providerEventId:
            `evt-received-${token}`,
          eventType:
            "payment.completed",
          payloadHash:
            `different-${token}`,
          payload: {
            duplicate: true,
          },
          signatureVerified:
            true,
          storefrontId:
            storefront.id,
        },
      });
    } catch (error) {
      duplicateRejected =
        isPrismaErrorCode(
          error,
          "P2002",
        );
    }

    assertCondition(
      duplicateRejected,
      "Duplicate provider event identifier was accepted.",
    );

    console.log(
      "PASS: Provider and provider-event identifier enforce durable idempotency.",
    );

    const failed =
      await prisma.paymentProviderEvent.create({
        data: {
          provider,
          providerEventId:
            `evt-failed-${token}`,
          eventType:
            "payment.failed",
          status:
            PaymentProviderEventStatus
              .FAILED,
          payloadHash:
            `sha256-failed-${token}`,
          payload: {
            event:
              "payment.failed",
            reference:
              `failed-reference-${token}`,
          },
          signatureVerified:
            true,
          storefrontId:
            storefront.id,
          attemptCount: 1,
          processingStartedAt:
            new Date(),
          failureCode:
            "AUDIT_FAILURE",
          failureMessage:
            "Temporary provider-event audit failure.",
        },
      });

    assertCondition(
      failed.status ===
        PaymentProviderEventStatus
          .FAILED &&
        failed.failureCode ===
          "AUDIT_FAILURE" &&
        failed.failureMessage !==
          null,
      "Provider-event failure details were not stored.",
    );

    console.log(
      "PASS: Provider-event processing failures retain diagnostic state.",
    );

    const ignored =
      await prisma.paymentProviderEvent.create({
        data: {
          provider,
          providerEventId:
            `evt-ignored-${token}`,
          eventType:
            "unrelated.event",
          status:
            PaymentProviderEventStatus
              .IGNORED,
          payloadHash:
            `sha256-ignored-${token}`,
          payload: {
            event:
              "unrelated.event",
          },
          signatureVerified:
            true,
          storefrontId:
            storefront.id,
          processedAt:
            new Date(),
        },
      });

    assertCondition(
      ignored.status ===
        PaymentProviderEventStatus
          .IGNORED,
      "Provider event could not be safely ignored.",
    );

    const storefrontCount =
      await prisma.storefront.findUnique({
        where: {
          id: storefront.id,
        },
        select: {
          _count: {
            select: {
              paymentProviderEvents:
                true,
            },
          },
        },
      });

    assertCondition(
      (
        storefrontCount?._count
          .paymentProviderEvents ??
        0
      ) >= 3,
      "Storefront provider-event relation is unavailable.",
    );

    console.log(
      "PASS: Storefront relation exposes its provider-event ledger.",
    );

    console.log(
      "PASS: Provider-neutral payment event foundation audit completed.",
    );
  } finally {
    await prisma.paymentProviderEvent.deleteMany({
      where: {
        provider,
      },
    });

    const remaining =
      await prisma.paymentProviderEvent.count({
        where: {
          provider,
        },
      });

    assertCondition(
      remaining === 0,
      "Temporary provider-event audit records remain.",
    );

    console.log(
      "PASS: Temporary provider-event audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch(
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
