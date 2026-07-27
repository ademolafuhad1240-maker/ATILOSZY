import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  OrderPaymentPurpose,
  OrderPaymentStatus,
  OrderStatus,
  PaymentProviderEventStatus,
  Prisma,
} from "../../generated/prisma/client";
import {
  prisma,
} from "../../lib/prisma";
import {
  PaymentServiceError,
} from "./errors";
import type {
  InitiateProductPaymentInput,
  CompleteProductPaymentReconciliationAttemptInput,
  ProcessProductPaymentEventInput,
  ProductPaymentReconciliationStart,
  ReconcileProductPaymentInput,
  ProductPaymentEventDisposition,
  ProductPaymentEventResult,
  ProductPaymentTransitionView,
} from "./types";

interface MoneyValue {
  toFixed(
    fractionDigits: number,
  ): string;
}

interface PaymentRecord {
  id: string;
  orderId: string;
  storefrontId: string;
  currencyCode: string;
  amount: MoneyValue;
  method:
    ProductPaymentTransitionView["method"];
  status:
    ProductPaymentTransitionView[
      "paymentStatus"
    ];
  provider: string | null;
  providerReference:
    string |
    null;
  idempotencyKey:
    string |
    null;
  initiatedAt: Date;
  paidAt:
    Date |
    null;
  failedAt:
    Date |
    null;
  order: {
    id: string;
    orderNumber: string;
    status:
      ProductPaymentTransitionView[
        "orderStatus"
      ];
    productPaymentStatus:
      ProductPaymentTransitionView[
        "productPaymentStatus"
      ];
  };
}

interface NormalizedInitiation {
  storefrontCode: string;
  userId: string;
  orderNumber: string;
  provider: string;
  providerReference: string;
  idempotencyKey: string;
  method:
    InitiateProductPaymentInput[
      "method"
    ];
  providerMetadata:
    InitiateProductPaymentInput[
      "providerMetadata"
    ];
}

interface NormalizedProviderEvent {
  provider: string;
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  payload:
    ProcessProductPaymentEventInput[
      "payload"
    ];
  signatureVerified: boolean;
  providerReference: string;
  amount: string;
  currencyCode: string;
  outcome:
    ProcessProductPaymentEventInput[
      "outcome"
    ];
  method:
    ProcessProductPaymentEventInput[
      "method"
    ];
  failureCode:
    string |
    undefined;
  failureMessage:
    string |
    undefined;
}

interface NormalizedReconciliation {
  storefrontCode: string;
  userId: string;
  orderNumber: string;
}

const reconciliationAttemptEventType =
  "payment.reconciliation.attempt";

const reconciliationCooldownMilliseconds =
  60_000;

function isPrismaErrorCode(
  error: unknown,
  expectedCode: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code ===
      expectedCode
  );
}

function requireText(
  value: string,
  label: string,
  maximumLength: number,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length === 0 ||
    normalized.length >
      maximumLength
  ) {
    throw new PaymentServiceError(
      "VALIDATION",
      `${label} is invalid.`,
    );
  }

  return normalized;
}

function normalizeStorefrontCode(
  value: string,
): string {
  const normalized =
    requireText(
      value,
      "Storefront code",
      3,
    ).toUpperCase();

  if (
    !/^[A-Z0-9]{3}$/.test(
      normalized,
    )
  ) {
    throw new PaymentServiceError(
      "VALIDATION",
      "Storefront code is invalid.",
    );
  }

  return normalized;
}

function normalizeProvider(
  value: string,
): string {
  return requireText(
    value,
    "Payment provider",
    80,
  ).toLowerCase();
}

function normalizeCurrencyCode(
  value: string,
): string {
  const normalized =
    requireText(
      value,
      "Currency code",
      3,
    ).toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      normalized,
    )
  ) {
    throw new PaymentServiceError(
      "VALIDATION",
      "Currency code is invalid.",
    );
  }

  return normalized;
}

function normalizeMoney(
  value: string,
): string {
  const normalized =
    requireText(
      value,
      "Payment amount",
      40,
    );

  const match =
    /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/
      .exec(normalized);

  if (!match) {
    throw new PaymentServiceError(
      "VALIDATION",
      "Payment amount must use at most two decimal places.",
    );
  }

  const fraction =
    (match[2] ?? "")
      .padEnd(
        2,
        "0",
      );

  const minorUnits =
    BigInt(match[1]) *
      100n +
    BigInt(fraction);

  if (minorUnits <= 0n) {
    throw new PaymentServiceError(
      "VALIDATION",
      "Payment amount must be greater than zero.",
    );
  }

  return (
    `${match[1]}.` +
    fraction
  );
}

function normalizeInitiation(
  input:
    InitiateProductPaymentInput,
): NormalizedInitiation {
  return {
    storefrontCode:
      normalizeStorefrontCode(
        input.storefrontCode,
      ),
    userId:
      requireText(
        input.userId,
        "User identifier",
        191,
      ),
    orderNumber:
      requireText(
        input.orderNumber,
        "Order number",
        40,
      ),
    provider:
      normalizeProvider(
        input.provider,
      ),
    providerReference:
      requireText(
        input.providerReference,
        "Provider reference",
        191,
      ),
    idempotencyKey:
      requireText(
        input.idempotencyKey,
        "Idempotency key",
        191,
      ),
    method:
      input.method,
    providerMetadata:
      input.providerMetadata,
  };
}

function normalizeProviderEvent(
  input:
    ProcessProductPaymentEventInput,
): NormalizedProviderEvent {
  return {
    provider:
      normalizeProvider(
        input.provider,
      ),
    providerEventId:
      requireText(
        input.providerEventId,
        "Provider event identifier",
        191,
      ),
    eventType:
      requireText(
        input.eventType,
        "Provider event type",
        120,
      ),
    payloadHash:
      requireText(
        input.payloadHash,
        "Payload hash",
        128,
      ),
    payload:
      input.payload,
    signatureVerified:
      input.signatureVerified,
    providerReference:
      requireText(
        input.providerReference,
        "Provider reference",
        191,
      ),
    amount:
      normalizeMoney(
        input.amount,
      ),
    currencyCode:
      normalizeCurrencyCode(
        input.currencyCode,
      ),
    outcome:
      input.outcome,
    method:
      input.method,
    failureCode:
      input.failureCode ===
        undefined
        ? undefined
        : requireText(
            input.failureCode,
            "Failure code",
            120,
          ),
    failureMessage:
      input.failureMessage ===
        undefined
        ? undefined
        : requireText(
            input.failureMessage,
            "Failure message",
            2000,
          ),
  };
}

function normalizeReconciliation(
  input:
    ReconcileProductPaymentInput,
): NormalizedReconciliation {
  return {
    storefrontCode:
      normalizeStorefrontCode(
        input.storefrontCode,
      ),
    userId:
      requireText(
        input.userId,
        "User identifier",
        191,
      ),
    orderNumber:
      requireText(
        input.orderNumber,
        "Order number",
        40,
      ),
  };
}

function reconciliationPayloadHash(
  payload:
    Prisma.InputJsonValue,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(payload),
      "utf8",
    )
    .digest("hex");
}

function toPaymentView(
  payment: PaymentRecord,
): ProductPaymentTransitionView {
  return {
    paymentId:
      payment.id,
    orderId:
      payment.orderId,
    orderNumber:
      payment.order
        .orderNumber,
    storefrontId:
      payment.storefrontId,
    currencyCode:
      payment.currencyCode,
    amount:
      payment.amount.toFixed(
        2,
      ),
    method:
      payment.method,
    paymentStatus:
      payment.status,
    provider:
      payment.provider,
    providerReference:
      payment.providerReference,
    idempotencyKey:
      payment.idempotencyKey,
    orderStatus:
      payment.order.status,
    productPaymentStatus:
      payment.order
        .productPaymentStatus,
    initiatedAt:
      payment.initiatedAt
        .toISOString(),
    paidAt:
      payment.paidAt
        ?.toISOString() ??
      null,
    failedAt:
      payment.failedAt
        ?.toISOString() ??
      null,
  };
}

async function runSerializable<T>(
  operation: (
    transaction:
      Prisma.TransactionClient,
  ) => Promise<T>,
): Promise<T> {
  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    try {
      return await prisma.$transaction(
        operation,
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,
        },
      );
    } catch (error) {
      if (
        attempt < 3 &&
        isPrismaErrorCode(
          error,
          "P2034",
        )
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new PaymentServiceError(
    "PAYMENT_CONFLICT",
    "The payment operation could not be completed safely.",
  );
}

async function lockOrder(
  transaction:
    Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const rows =
    await transaction.$queryRaw<
      Array<{
        id: string;
      }>
    >(Prisma.sql`
      SELECT id
      FROM orders
      WHERE id = ${orderId}
      FOR UPDATE
    `);

  if (!rows[0]) {
    throw new PaymentServiceError(
      "ORDER_NOT_FOUND",
      "The order was not found.",
    );
  }
}

async function loadPayment(
  transaction:
    Prisma.TransactionClient,
  paymentId: string,
): Promise<PaymentRecord> {
  const payment =
    await transaction.orderPayment
      .findUnique({
        where: {
          id: paymentId,
        },
        include: {
          order: true,
        },
      });

  if (!payment) {
    throw new PaymentServiceError(
      "PRODUCT_PAYMENT_NOT_FOUND",
      "The product payment was not found.",
    );
  }

  return payment;
}

async function eventResult(
  transaction:
    Prisma.TransactionClient,
  input: {
    eventId: string;
    eventStatus:
      PaymentProviderEventStatus;
    disposition:
      ProductPaymentEventDisposition;
    duplicate: boolean;
    failureCode:
      string |
      null;
    failureMessage:
      string |
      null;
    orderPaymentId:
      string |
      null;
  },
): Promise<ProductPaymentEventResult> {
  const payment =
    input.orderPaymentId ===
      null
      ? null
      : toPaymentView(
          await loadPayment(
            transaction,
            input.orderPaymentId,
          ),
        );

  return {
    eventId:
      input.eventId,
    eventStatus:
      input.eventStatus,
    disposition:
      input.disposition,
    duplicate:
      input.duplicate,
    failureCode:
      input.failureCode,
    failureMessage:
      input.failureMessage,
    payment,
  };
}

export async function initiateProductPayment(
  input:
    InitiateProductPaymentInput,
): Promise<ProductPaymentTransitionView> {
  const normalized =
    normalizeInitiation(
      input,
    );

  try {
    return await runSerializable(
      async (
        transaction,
      ) => {
        const storefront =
          await transaction.storefront
            .findUnique({
              where: {
                code:
                  normalized
                    .storefrontCode,
              },
              select: {
                id: true,
              },
            });

        if (!storefront) {
          throw new PaymentServiceError(
            "STOREFRONT_NOT_FOUND",
            "The storefront was not found.",
          );
        }

        const order =
          await transaction.order
            .findFirst({
              where: {
                orderNumber:
                  normalized
                    .orderNumber,
                storefrontId:
                  storefront.id,
                userId:
                  normalized.userId,
              },
            });

        if (!order) {
          throw new PaymentServiceError(
            "ORDER_NOT_FOUND",
            "The order was not found.",
          );
        }

        await lockOrder(
          transaction,
          order.id,
        );

        const lockedOrder =
          await transaction.order
            .findUnique({
              where: {
                id: order.id,
              },
            });

        if (!lockedOrder) {
          throw new PaymentServiceError(
            "ORDER_NOT_FOUND",
            "The order was not found.",
          );
        }

        if (
          lockedOrder.status ===
            OrderStatus.PAID ||
          lockedOrder
            .productPaymentStatus ===
            OrderPaymentStatus.PAID ||
          lockedOrder.status ===
            OrderStatus.CANCELLED ||
          lockedOrder.status ===
            OrderStatus.REFUND_PENDING ||
          lockedOrder.status ===
            OrderStatus.REFUNDED
        ) {
          throw new PaymentServiceError(
            "ORDER_NOT_PAYABLE",
            "The order cannot begin another product payment.",
          );
        }

        const idempotentPayment =
          await transaction.orderPayment
            .findFirst({
              where: {
                storefrontId:
                  storefront.id,
                idempotencyKey:
                  normalized
                    .idempotencyKey,
              },
              include: {
                order: true,
              },
            });

        if (
          idempotentPayment
        ) {
          if (
            idempotentPayment
              .orderId ===
              lockedOrder.id &&
            idempotentPayment
              .provider ===
              normalized.provider &&
            idempotentPayment
              .providerReference ===
              normalized
                .providerReference &&
            idempotentPayment
              .method ===
              normalized.method
          ) {
            return toPaymentView(
              idempotentPayment,
            );
          }

          throw new PaymentServiceError(
            "PAYMENT_IDEMPOTENCY_CONFLICT",
            "The idempotency key belongs to a different payment request.",
          );
        }

        const referencePayment =
          await transaction.orderPayment
            .findFirst({
              where: {
                provider:
                  normalized.provider,
                providerReference:
                  normalized
                    .providerReference,
              },
              include: {
                order: true,
              },
            });

        if (
          referencePayment
        ) {
          if (
            referencePayment
              .orderId ===
              lockedOrder.id &&
            referencePayment
              .idempotencyKey ===
              normalized
                .idempotencyKey &&
            referencePayment
              .method ===
              normalized.method
          ) {
            return toPaymentView(
              referencePayment,
            );
          }

          throw new PaymentServiceError(
            "PAYMENT_REFERENCE_CONFLICT",
            "The provider reference belongs to a different payment request.",
          );
        }

        const latestPayment =
          await transaction.orderPayment
            .findFirst({
              where: {
                orderId:
                  lockedOrder.id,
                purpose:
                  OrderPaymentPurpose
                    .PRODUCT,
              },
              orderBy: {
                createdAt:
                  "desc",
              },
            });

        if (!latestPayment) {
          throw new PaymentServiceError(
            "PRODUCT_PAYMENT_NOT_FOUND",
            "The order does not contain a product payment record.",
          );
        }

        if (
          latestPayment.status ===
            OrderPaymentStatus
              .PROCESSING
        ) {
          throw new PaymentServiceError(
            "PAYMENT_ALREADY_PROCESSING",
            "A product payment is already processing for this order.",
          );
        }

        let paymentId: string;

        if (
          latestPayment.status ===
            OrderPaymentStatus
              .PENDING &&
          latestPayment.provider ===
            null &&
          latestPayment
            .providerReference ===
            null
        ) {
          const updated =
            await transaction
              .orderPayment
              .update({
                where: {
                  id:
                    latestPayment.id,
                },
                data: {
                  method:
                    normalized.method,
                  status:
                    OrderPaymentStatus
                      .PROCESSING,
                  provider:
                    normalized.provider,
                  providerReference:
                    normalized
                      .providerReference,
                  idempotencyKey:
                    normalized
                      .idempotencyKey,
                  failureCode:
                    null,
                  failureMessage:
                    null,
                  failedAt:
                    null,
                  cancelledAt:
                    null,
                  ...(
                    normalized
                      .providerMetadata ===
                    undefined
                      ? {}
                      : {
                          providerMetadata:
                            normalized
                              .providerMetadata,
                        }
                  ),
                },
              });

          paymentId =
            updated.id;
        } else {
          const created =
            await transaction
              .orderPayment
              .create({
                data: {
                  orderId:
                    lockedOrder.id,
                  storefrontId:
                    lockedOrder
                      .storefrontId,
                  currencyCode:
                    lockedOrder
                      .currencyCode,
                  purpose:
                    OrderPaymentPurpose
                      .PRODUCT,
                  method:
                    normalized.method,
                  status:
                    OrderPaymentStatus
                      .PROCESSING,
                  amount:
                    lockedOrder
                      .productTotal,
                  provider:
                    normalized.provider,
                  providerReference:
                    normalized
                      .providerReference,
                  idempotencyKey:
                    normalized
                      .idempotencyKey,
                  ...(
                    normalized
                      .providerMetadata ===
                    undefined
                      ? {}
                      : {
                          providerMetadata:
                            normalized
                              .providerMetadata,
                        }
                  ),
                },
              });

          paymentId =
            created.id;
        }

        await transaction.order
          .update({
            where: {
              id:
                lockedOrder.id,
            },
            data: {
              status:
                OrderStatus
                  .PAYMENT_PROCESSING,
              productPaymentStatus:
                OrderPaymentStatus
                  .PROCESSING,
            },
          });

        return toPaymentView(
          await loadPayment(
            transaction,
            paymentId,
          ),
        );
      },
    );
  } catch (error) {
    if (
      isPrismaErrorCode(
        error,
        "P2002",
      )
    ) {
      throw new PaymentServiceError(
        "PAYMENT_REFERENCE_CONFLICT",
        "The provider reference or idempotency key is already in use.",
      );
    }

    throw error;
  }
}

export async function beginProductPaymentReconciliation(
  input:
    ReconcileProductPaymentInput,
): Promise<
  ProductPaymentReconciliationStart
> {
  const normalized =
    normalizeReconciliation(
      input,
    );

  return runSerializable(
    async (transaction) => {
      const storefront =
        await transaction.storefront
          .findUnique({
            where: {
              code:
                normalized
                  .storefrontCode,
            },
            select: {
              id: true,
            },
          });

      if (!storefront) {
        throw new PaymentServiceError(
          "STOREFRONT_NOT_FOUND",
          "The storefront was not found.",
        );
      }

      const order =
        await transaction.order
          .findFirst({
            where: {
              orderNumber:
                normalized
                  .orderNumber,
              storefrontId:
                storefront.id,
              userId:
                normalized.userId,
            },
            select: {
              id: true,
            },
          });

      if (!order) {
        throw new PaymentServiceError(
          "ORDER_NOT_FOUND",
          "The order was not found.",
        );
      }

      await lockOrder(
        transaction,
        order.id,
      );

      const discoveredPayment =
        await transaction
          .orderPayment
          .findFirst({
            where: {
              orderId:
                order.id,
              purpose:
                OrderPaymentPurpose
                  .PRODUCT,
            },
            orderBy: {
              createdAt: "desc",
            },
            select: {
              id: true,
            },
          });

      if (!discoveredPayment) {
        throw new PaymentServiceError(
          "PRODUCT_PAYMENT_NOT_FOUND",
          "The order does not contain a product payment record.",
        );
      }

      const lockedPayment =
        await transaction
          .$queryRaw<
            Array<{
              id: string;
            }>
          >(Prisma.sql`
            SELECT id
            FROM order_payments
            WHERE id =
              ${discoveredPayment.id}
            FOR UPDATE
          `);

      if (!lockedPayment[0]) {
        throw new PaymentServiceError(
          "PAYMENT_CONFLICT",
          "The product payment could not be locked.",
        );
      }

      const payment =
        await loadPayment(
          transaction,
          discoveredPayment.id,
        );

      if (
        payment.status ===
          OrderPaymentStatus.PAID ||
        payment.status ===
          OrderPaymentStatus.FAILED ||
        payment.status ===
          OrderPaymentStatus.CANCELLED ||
        payment.status ===
          OrderPaymentStatus
            .PARTIALLY_REFUNDED ||
        payment.status ===
          OrderPaymentStatus.REFUNDED ||
        payment.order.status ===
          OrderStatus.CANCELLED ||
        payment.order.status ===
          OrderStatus.REFUND_PENDING ||
        payment.order.status ===
          OrderStatus.REFUNDED
      ) {
        return {
          kind:
            "TERMINAL",
          payment:
            toPaymentView(
              payment,
            ),
        };
      }

      if (
        payment.status !==
          OrderPaymentStatus
            .PROCESSING ||
        payment.provider === null ||
        payment.providerReference ===
          null
      ) {
        throw new PaymentServiceError(
          "PAYMENT_NOT_RECONCILABLE",
          "The product payment is not awaiting provider verification.",
        );
      }

      const now =
        new Date();

      const latestAttempt =
        await transaction
          .paymentProviderEvent
          .findFirst({
            where: {
              orderPaymentId:
                payment.id,
              eventType:
                reconciliationAttemptEventType,
              receivedAt: {
                gt:
                  new Date(
                    now.getTime() -
                      reconciliationCooldownMilliseconds,
                  ),
              },
            },
            orderBy: {
              receivedAt:
                "desc",
            },
          });

      if (latestAttempt) {
        const elapsed =
          now.getTime() -
          latestAttempt
            .receivedAt
            .getTime();

        return {
          kind:
            "RATE_LIMITED",
          checkedAt:
            latestAttempt
              .receivedAt
              .toISOString(),
          retryAfterSeconds:
            Math.max(
              1,
              Math.ceil(
                (
                  reconciliationCooldownMilliseconds -
                  elapsed
                ) / 1000,
              ),
            ),
          payment:
            toPaymentView(
              payment,
            ),
        };
      }

      const payload = {
        source:
          "SERVER_RECONCILIATION",
        paymentId:
          payment.id,
        startedAt:
          now.toISOString(),
      };

      const attempt =
        await transaction
          .paymentProviderEvent
          .create({
            data: {
              provider:
                payment.provider,
              providerEventId:
                `reconciliation-attempt:${randomUUID()}`,
              eventType:
                reconciliationAttemptEventType,
              status:
                PaymentProviderEventStatus
                  .PROCESSING,
              payloadHash:
                reconciliationPayloadHash(
                  payload,
                ),
              payload,
              signatureVerified:
                false,
              storefrontId:
                payment.storefrontId,
              orderPaymentId:
                payment.id,
              attemptCount: 1,
              processingStartedAt:
                now,
            },
          });

      return {
        kind: "ATTEMPT",
        attemptEventId:
          attempt.id,
        provider:
          payment.provider,
        providerReference:
          payment
            .providerReference,
        amount:
          payment.amount.toFixed(
            2,
          ),
        currencyCode:
          payment.currencyCode,
        method:
          payment.method,
        checkedAt:
          now.toISOString(),
        retryAfterSeconds:
          reconciliationCooldownMilliseconds /
          1000,
        payment:
          toPaymentView(
            payment,
          ),
      };
    },
  );
}

export async function completeProductPaymentReconciliationAttempt(
  input:
    CompleteProductPaymentReconciliationAttemptInput,
): Promise<void> {
  const attemptEventId =
    requireText(
      input.attemptEventId,
      "Reconciliation attempt identifier",
      191,
    );

  const payloadHash =
    requireText(
      input.payloadHash,
      "Reconciliation payload hash",
      128,
    );

  const failureCode =
    input.failureCode ===
      undefined ||
    input.failureCode === null
      ? null
      : requireText(
          input.failureCode,
          "Reconciliation failure code",
          120,
        );

  const failureMessage =
    input.failureMessage ===
      undefined ||
    input.failureMessage === null
      ? null
      : requireText(
          input.failureMessage,
          "Reconciliation failure message",
          2000,
        );

  const status =
    PaymentProviderEventStatus[
      input.status
    ];

  await runSerializable(
    async (transaction) => {
      const completedAt =
        new Date();

      const updated =
        await transaction
          .paymentProviderEvent
          .updateMany({
            where: {
              id:
                attemptEventId,
              eventType:
                reconciliationAttemptEventType,
              status:
                PaymentProviderEventStatus
                  .PROCESSING,
            },
            data: {
              status,
              payloadHash,
              payload:
                input.payload,
              signatureVerified:
                input
                  .providerVerified,
              processedAt:
                completedAt,
              failureCode,
              failureMessage,
            },
          });

      if (updated.count === 1) {
        return;
      }

      const existing =
        await transaction
          .paymentProviderEvent
          .findUnique({
            where: {
              id:
                attemptEventId,
            },
          });

      if (
        existing &&
        existing.eventType ===
          reconciliationAttemptEventType &&
        existing.status ===
          status &&
        existing.payloadHash ===
          payloadHash
      ) {
        return;
      }

      throw new PaymentServiceError(
        "PAYMENT_CONFLICT",
        "The reconciliation attempt could not be completed.",
      );
    },
  );
}

async function processProviderEventOnce(
  input:
    NormalizedProviderEvent,
): Promise<ProductPaymentEventResult> {
  return runSerializable(
    async (
      transaction,
    ) => {
      let event =
        await transaction
          .paymentProviderEvent
          .findFirst({
            where: {
              provider:
                input.provider,
              providerEventId:
                input
                  .providerEventId,
            },
          });

      if (event) {
        const locked =
          await transaction
            .$queryRaw<
              Array<{
                id: string;
              }>
            >(Prisma.sql`
              SELECT id
              FROM payment_provider_events
              WHERE
                provider =
                  ${input.provider}
                AND "providerEventId" =
                  ${input.providerEventId}
              FOR UPDATE
            `);

        if (!locked[0]) {
          throw new PaymentServiceError(
            "PAYMENT_CONFLICT",
            "The provider event could not be locked.",
          );
        }

        event =
          await transaction
            .paymentProviderEvent
            .findUnique({
              where: {
                id:
                  event.id,
              },
            });

        if (!event) {
          throw new PaymentServiceError(
            "PAYMENT_CONFLICT",
            "The provider event could not be reloaded.",
          );
        }

        if (
          event.payloadHash !==
            input.payloadHash
        ) {
          throw new PaymentServiceError(
            "EVENT_PAYLOAD_CONFLICT",
            "The provider event identifier was reused with a different payload.",
          );
        }

        if (
          event.status ===
            PaymentProviderEventStatus
              .PROCESSED ||
          event.status ===
            PaymentProviderEventStatus
              .IGNORED
        ) {
          let disposition:
            ProductPaymentEventDisposition =
              "IGNORED";

          if (
            event.status ===
              PaymentProviderEventStatus
                .PROCESSED &&
            event.orderPaymentId !==
              null
          ) {
            const payment =
              await loadPayment(
                transaction,
                event.orderPaymentId,
              );

            disposition =
              payment.status ===
                OrderPaymentStatus
                  .PAID
                ? "PAID"
                : "FAILED";
          }

          return eventResult(
            transaction,
            {
              eventId:
                event.id,
              eventStatus:
                event.status,
              disposition,
              duplicate:
                true,
              failureCode:
                event.failureCode,
              failureMessage:
                event.failureMessage,
              orderPaymentId:
                event.orderPaymentId,
            },
          );
        }
      } else {
        event =
          await transaction
            .paymentProviderEvent
            .create({
              data: {
                provider:
                  input.provider,
                providerEventId:
                  input
                    .providerEventId,
                eventType:
                  input.eventType,
                status:
                  PaymentProviderEventStatus
                    .RECEIVED,
                payloadHash:
                  input.payloadHash,
                payload:
                  input.payload,
                signatureVerified:
                  input
                    .signatureVerified,
              },
            });
      }

      event =
        await transaction
          .paymentProviderEvent
          .update({
            where: {
              id:
                event.id,
            },
            data: {
              status:
                PaymentProviderEventStatus
                  .PROCESSING,
              signatureVerified:
                input
                  .signatureVerified,
              processingStartedAt:
                new Date(),
              processedAt:
                null,
              failureCode:
                null,
              failureMessage:
                null,
              attemptCount: {
                increment: 1,
              },
            },
          });

      if (
        !input.signatureVerified
      ) {
        const failedEvent =
          await transaction
            .paymentProviderEvent
            .update({
              where: {
                id:
                  event.id,
              },
              data: {
                status:
                  PaymentProviderEventStatus
                    .FAILED,
                failureCode:
                  "SIGNATURE_NOT_VERIFIED",
                failureMessage:
                  "The provider event signature was not verified.",
              },
            });

        return eventResult(
          transaction,
          {
            eventId:
              failedEvent.id,
            eventStatus:
              failedEvent.status,
            disposition:
              "REJECTED",
            duplicate:
              false,
            failureCode:
              failedEvent
                .failureCode,
            failureMessage:
              failedEvent
                .failureMessage,
            orderPaymentId:
              null,
          },
        );
      }

      const discoveredPayment =
        await transaction
          .orderPayment
          .findFirst({
            where: {
              provider:
                input.provider,
              providerReference:
                input
                  .providerReference,
            },
          });

      if (!discoveredPayment) {
        const ignoredEvent =
          await transaction
            .paymentProviderEvent
            .update({
              where: {
                id:
                  event.id,
              },
              data: {
                status:
                  PaymentProviderEventStatus
                    .IGNORED,
                processedAt:
                  new Date(),
                failureCode:
                  "PAYMENT_NOT_FOUND",
                failureMessage:
                  "No product payment matched the provider reference.",
              },
            });

        return eventResult(
          transaction,
          {
            eventId:
              ignoredEvent.id,
            eventStatus:
              ignoredEvent.status,
            disposition:
              "IGNORED",
            duplicate:
              false,
            failureCode:
              ignoredEvent
                .failureCode,
            failureMessage:
              ignoredEvent
                .failureMessage,
            orderPaymentId:
              null,
          },
        );
      }

      await lockOrder(
        transaction,
        discoveredPayment
          .orderId,
      );

      const payment =
        await loadPayment(
          transaction,
          discoveredPayment.id,
        );

      if (
        payment.status ===
          OrderPaymentStatus.PAID ||
        payment.order
          .productPaymentStatus ===
          OrderPaymentStatus.PAID ||
        payment.order.status ===
          OrderStatus.PAID
      ) {
        const processedEvent =
          await transaction
            .paymentProviderEvent
            .update({
              where: {
                id:
                  event.id,
              },
              data: {
                status:
                  PaymentProviderEventStatus
                    .PROCESSED,
                storefrontId:
                  payment
                    .storefrontId,
                orderPaymentId:
                  payment.id,
                processedAt:
                  new Date(),
                failureCode:
                  null,
                failureMessage:
                  null,
              },
            });

        return eventResult(
          transaction,
          {
            eventId:
              processedEvent.id,
            eventStatus:
              processedEvent.status,
            disposition:
              "PAID",
            duplicate:
              true,
            failureCode:
              null,
            failureMessage:
              null,
            orderPaymentId:
              payment.id,
          },
        );
      }

      let failureCode:
        string |
        null = null;

      let failureMessage:
        string |
        null = null;

      if (
        payment.currencyCode !==
          input.currencyCode
      ) {
        failureCode =
          "CURRENCY_MISMATCH";

        failureMessage =
          "The provider currency does not match the order currency.";
      } else if (
        payment.amount.toFixed(
          2,
        ) !== input.amount
      ) {
        failureCode =
          "AMOUNT_MISMATCH";

        failureMessage =
          "The provider amount does not match the product payment amount.";
      } else if (
        input.outcome ===
          "FAILED"
      ) {
        failureCode =
          input.failureCode ??
          "PROVIDER_REPORTED_FAILURE";

        failureMessage =
          input.failureMessage ??
          "The payment provider reported that the payment failed.";
      } else if (
        payment.order.status ===
          OrderStatus.CANCELLED ||
        payment.order.status ===
          OrderStatus.REFUND_PENDING ||
        payment.order.status ===
          OrderStatus.REFUNDED
      ) {
        failureCode =
          "ORDER_NOT_PAYABLE";

        failureMessage =
          "The order cannot accept a product payment.";
      }

      if (
        failureCode !== null
      ) {
        const failedAt =
          new Date();

        await transaction
          .orderPayment
          .update({
            where: {
              id:
                payment.id,
            },
            data: {
              status:
                OrderPaymentStatus
                  .FAILED,
              failureCode,
              failureMessage,
              failedAt,
            },
          });

        await transaction.order
          .update({
            where: {
              id:
                payment.orderId,
            },
            data: {
              status:
                OrderStatus
                  .PENDING_PAYMENT,
              productPaymentStatus:
                OrderPaymentStatus
                  .FAILED,
            },
          });

        const failedEvent =
          await transaction
            .paymentProviderEvent
            .update({
              where: {
                id:
                  event.id,
              },
              data: {
                status:
                  PaymentProviderEventStatus
                    .FAILED,
                storefrontId:
                  payment
                    .storefrontId,
                orderPaymentId:
                  payment.id,
                failureCode,
                failureMessage,
              },
            });

        return eventResult(
          transaction,
          {
            eventId:
              failedEvent.id,
            eventStatus:
              failedEvent.status,
            disposition:
              "FAILED",
            duplicate:
              false,
            failureCode:
              failedEvent
                .failureCode,
            failureMessage:
              failedEvent
                .failureMessage,
            orderPaymentId:
              payment.id,
          },
        );
      }

      const paidAt =
        new Date();

      await transaction
        .orderPayment
        .update({
          where: {
            id:
              payment.id,
          },
          data: {
            status:
              OrderPaymentStatus
                .PAID,
            method:
              input.method ??
              payment.method,
            failureCode:
              null,
            failureMessage:
              null,
            failedAt:
              null,
            paidAt,
          },
        });

      await transaction.order
        .update({
          where: {
            id:
              payment.orderId,
          },
          data: {
            status:
              OrderStatus.PAID,
            productPaymentStatus:
              OrderPaymentStatus
                .PAID,
            paidAt,
          },
        });

      const processedEvent =
        await transaction
          .paymentProviderEvent
          .update({
            where: {
              id:
                event.id,
            },
            data: {
              status:
                PaymentProviderEventStatus
                  .PROCESSED,
              storefrontId:
                payment
                  .storefrontId,
              orderPaymentId:
                payment.id,
              processedAt:
                paidAt,
              failureCode:
                null,
              failureMessage:
                null,
            },
          });

      return eventResult(
        transaction,
        {
          eventId:
            processedEvent.id,
          eventStatus:
            processedEvent.status,
          disposition:
            "PAID",
          duplicate:
            false,
          failureCode:
            null,
          failureMessage:
            null,
          orderPaymentId:
            payment.id,
        },
      );
    },
  );
}

export async function processProductPaymentEvent(
  input:
    ProcessProductPaymentEventInput,
): Promise<ProductPaymentEventResult> {
  const normalized =
    normalizeProviderEvent(
      input,
    );

  try {
    return await processProviderEventOnce(
      normalized,
    );
  } catch (error) {
    if (
      isPrismaErrorCode(
        error,
        "P2002",
      )
    ) {
      return processProviderEventOnce(
        normalized,
      );
    }

    throw error;
  }
}
