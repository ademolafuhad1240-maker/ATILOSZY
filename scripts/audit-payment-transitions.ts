import {
  randomBytes,
} from "node:crypto";

import {
  OrderFulfilmentMethod,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  ProductStatus,
  StorefrontProductStatus,
  UserStatus,
} from "../src/generated/prisma/client";
import {
  prisma,
} from "../src/lib/prisma";
import {
  createCatalogProduct,
} from "../src/server/catalog";
import {
  addCartItem,
  getOrCreateActiveCart,
} from "../src/server/cart";
import {
  cancelPendingCheckoutOrder,
  CheckoutServiceError,
  createCheckoutOrder,
} from "../src/server/checkout";
import {
  initiateProductPayment,
  isPaymentServiceErrorCode,
  processProductPaymentEvent,
} from "../src/server/payments";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectPaymentError(
  label: string,
  code:
    Parameters<
      typeof isPaymentServiceErrorCode
    >[1],
  operation:
    () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (
      isPaymentServiceErrorCode(
        error,
        code,
      )
    ) {
      console.log(
        `PASS: Rejected ${label}.`,
      );

      return;
    }

    throw error;
  }

  throw new Error(
    `Expected ${label} to fail with ${code}.`,
  );
}

async function main(): Promise<void> {
  console.log(
    "=== PROVIDER-NEUTRAL PRODUCT PAYMENT TRANSITION AUDIT ===",
  );

  const token =
    randomBytes(10)
      .toString("hex");

  const provider =
    `audit-transition-${token}`;

  const email =
    `payment-transition-${token}@example.invalid`;

  const phone =
    `+23480${token.slice(0, 8)}`;

  const productSlug =
    `payment-transition-${token}`;

  const productIds:
    string[] = [];

  const userIds:
    string[] = [];

  const variantIds:
    string[] = [];

  let baselineReserved = 0;

  const storefront =
    await prisma.storefront
      .findUnique({
        where: {
          code: "ATI",
        },
        select: {
          id: true,
          currencyCode: true,
        },
      });

  assertCondition(
    storefront,
    "ATI storefront was not found.",
  );

  try {
    const now =
      new Date();

    const user =
      await prisma.user.create({
        data: {
          storefrontId:
            storefront.id,
          email,
          normalizedEmail:
            email,
          phone,
          normalizedPhone:
            phone,
          passwordHash:
            `audit-hash-${token}`,
          status:
            UserStatus.ACTIVE,
          emailVerifiedAt:
            now,
          phoneVerifiedAt:
            now,
        },
      });

    userIds.push(
      user.id,
    );

    await prisma.storefrontCustomer
      .create({
        data: {
          userId:
            user.id,
          storefrontId:
            storefront.id,
          firstName:
            "Payment",
          lastName:
            "Audit",
          displayName:
            "Payment Audit",
          termsAcceptedAt:
            now,
          privacyAcceptedAt:
            now,
        },
      });

    const product =
      await createCatalogProduct({
        storefrontKey:
          "atiloszy",
        categorySlug:
          "shoes",
        listingSlug:
          productSlug,
        name:
          "Temporary payment transition audit product",
        shortDescription:
          "Temporary product for payment transition testing.",
        description:
          "This record is removed automatically after the audit.",
        brand:
          "SORVYRA Audit",
        productStatus:
          ProductStatus.ACTIVE,
        listingStatus:
          StorefrontProductStatus
            .ACTIVE,
        isDemo: true,
        publishedAt:
          new Date(
            Date.now() -
              60_000,
          ),
        variant: {
          sku:
            `ATI-PAY-${token.toUpperCase()}`,
          title:
            "Payment audit variant",
          price: {
            amount:
              "15000.00",
          },
          initialStock: 20,
          reorderLevel: 1,
          isTracked: true,
          allowBackorder:
            false,
        },
      });

    productIds.push(
      product.productId,
    );

    variantIds.push(
      product.variantId,
    );

    const inventoryBefore =
      await prisma.inventory
        .findFirstOrThrow({
          where: {
            storefrontId:
              storefront.id,
            productVariantId:
              product.variantId,
          },
        });

    baselineReserved =
      inventoryBefore
        .quantityReserved;

    async function createAuditOrder(
      suffix: string,
    ) {
      const cart =
        await getOrCreateActiveCart({
          storefrontCode:
            "ATI",
          userId:
            user.id,
        });

      await addCartItem({
        storefrontCode:
          "ATI",
        userId:
          user.id,
        productVariantId:
          product.variantId,
        quantity: 1,
      });

      const order =
        await createCheckoutOrder({
          storefrontCode:
            "ATI",
          userId:
            user.id,
          cartId:
            cart.id,
          fulfilmentMethod:
            OrderFulfilmentMethod
              .PICKUP,
          customerNote:
            `Payment transition audit ${suffix}.`,
        });

      return order;
    }

    const successOrder =
      await createAuditOrder(
        "success",
      );

    const successReference =
      `success-${token}`;

    const initiated =
      await initiateProductPayment({
        storefrontCode:
          "ATI",
        userId:
          user.id,
        orderNumber:
          successOrder
            .orderNumber,
        provider,
        providerReference:
          successReference,
        idempotencyKey:
          `init-success-${token}`,
        method:
          OrderPaymentMethod
            .CARD,
        providerMetadata: {
          audit:
            "success",
        },
      });

    assertCondition(
      initiated.paymentStatus ===
        OrderPaymentStatus
          .PROCESSING &&
        initiated.orderStatus ===
          OrderStatus
            .PAYMENT_PROCESSING &&
        initiated
          .productPaymentStatus ===
          OrderPaymentStatus
            .PROCESSING,
      "Payment initiation did not enter the processing state.",
    );

    const repeatedInitiation =
      await initiateProductPayment({
        storefrontCode:
          "ATI",
        userId:
          user.id,
        orderNumber:
          successOrder
            .orderNumber,
        provider,
        providerReference:
          successReference,
        idempotencyKey:
          `init-success-${token}`,
        method:
          OrderPaymentMethod
            .CARD,
      });

    assertCondition(
      repeatedInitiation
        .paymentId ===
        initiated.paymentId,
      "Repeated initiation created a duplicate payment attempt.",
    );

    console.log(
      "PASS: Product payment initiation is idempotent and enters processing.",
    );

    const successEvent =
      await processProductPaymentEvent({
        provider,
        providerEventId:
          `event-success-${token}`,
        eventType:
          "payment.completed",
        payloadHash:
          `hash-success-${token}`,
        payload: {
          event:
            "payment.completed",
          reference:
            successReference,
          amount:
            "15000.00",
          currency:
            "NGN",
        },
        signatureVerified:
          true,
        providerReference:
          successReference,
        amount:
          "15000.00",
        currencyCode:
          "NGN",
        outcome:
          "SUCCEEDED",
        method:
          OrderPaymentMethod
            .CARD,
      });

    assertCondition(
      successEvent
        .disposition ===
        "PAID" &&
        successEvent
          .eventStatus ===
          "PROCESSED" &&
        successEvent.payment
          ?.paymentStatus ===
          OrderPaymentStatus
            .PAID &&
        successEvent.payment
          .orderStatus ===
          OrderStatus.PAID,
      "Successful provider event did not mark the payment and order paid.",
    );

    console.log(
      "PASS: Verified amount and currency transition the product payment and order to paid.",
    );

    const duplicateSuccess =
      await processProductPaymentEvent({
        provider,
        providerEventId:
          `event-success-${token}`,
        eventType:
          "payment.completed",
        payloadHash:
          `hash-success-${token}`,
        payload: {
          event:
            "payment.completed",
          reference:
            successReference,
          amount:
            "15000.00",
          currency:
            "NGN",
        },
        signatureVerified:
          true,
        providerReference:
          successReference,
        amount:
          "15000.00",
        currencyCode:
          "NGN",
        outcome:
          "SUCCEEDED",
      });

    assertCondition(
      duplicateSuccess
        .duplicate &&
        duplicateSuccess
          .payment
          ?.paymentId ===
          initiated.paymentId,
      "Duplicate provider event was not handled idempotently.",
    );

    await expectPaymentError(
      "provider event identifier reuse with a different payload",
      "EVENT_PAYLOAD_CONFLICT",
      () =>
        processProductPaymentEvent({
          provider,
          providerEventId:
            `event-success-${token}`,
          eventType:
            "payment.completed",
          payloadHash:
            `different-hash-${token}`,
          payload: {
            changed: true,
          },
          signatureVerified:
            true,
          providerReference:
            successReference,
          amount:
            "15000.00",
          currencyCode:
            "NGN",
          outcome:
            "SUCCEEDED",
        }),
    );

    console.log(
      "PASS: Duplicate events are safe and conflicting payload reuse is rejected.",
    );

    const reservedAfterPaid =
      await prisma.inventory
        .findFirstOrThrow({
          where: {
            productVariantId:
              product.variantId,
          },
        });

    assertCondition(
      reservedAfterPaid
        .quantityReserved ===
        baselineReserved + 1,
      "Paid transition unexpectedly changed the reserved inventory.",
    );

    console.log(
      "PASS: Paying an order preserves its existing inventory reservation.",
    );

    try {
      await cancelPendingCheckoutOrder({
        storefrontCode:
          "ATI",
        userId:
          user.id,
        orderNumber:
          successOrder
            .orderNumber,
      });

      throw new Error(
        "Paid order cancellation unexpectedly succeeded.",
      );
    } catch (error) {
      assertCondition(
        error instanceof
          CheckoutServiceError &&
        error.code ===
          "ORDER_NOT_CANCELLABLE",
        "Paid order cancellation returned the wrong error.",
      );
    }

    console.log(
      "PASS: Paid orders remain protected from unpaid-order cancellation.",
    );

    const failedOrder =
      await createAuditOrder(
        "provider failure",
      );

    const failedReference =
      `failed-${token}`;

    await initiateProductPayment({
      storefrontCode:
        "ATI",
      userId:
        user.id,
      orderNumber:
        failedOrder.orderNumber,
      provider,
      providerReference:
        failedReference,
      idempotencyKey:
        `init-failed-${token}`,
      method:
        OrderPaymentMethod.CARD,
    });

    const failedEvent =
      await processProductPaymentEvent({
        provider,
        providerEventId:
          `event-failed-${token}`,
        eventType:
          "payment.failed",
        payloadHash:
          `hash-failed-${token}`,
        payload: {
          event:
            "payment.failed",
          reference:
            failedReference,
        },
        signatureVerified:
          true,
        providerReference:
          failedReference,
        amount:
          "15000.00",
        currencyCode:
          "NGN",
        outcome:
          "FAILED",
        failureCode:
          "AUDIT_PROVIDER_FAILURE",
        failureMessage:
          "Temporary provider failure.",
      });

    assertCondition(
      failedEvent
        .disposition ===
        "FAILED" &&
        failedEvent.payment
          ?.paymentStatus ===
          OrderPaymentStatus
            .FAILED &&
        failedEvent.payment
          .orderStatus ===
          OrderStatus
            .PENDING_PAYMENT,
      "Provider failure did not reopen the order for another payment attempt.",
    );

    console.log(
      "PASS: Provider failure records diagnostics and returns the order to pending payment.",
    );

    const amountOrder =
      await createAuditOrder(
        "amount mismatch",
      );

    const amountReference =
      `amount-${token}`;

    await initiateProductPayment({
      storefrontCode:
        "ATI",
      userId:
        user.id,
      orderNumber:
        amountOrder.orderNumber,
      provider,
      providerReference:
        amountReference,
      idempotencyKey:
        `init-amount-${token}`,
      method:
        OrderPaymentMethod.CARD,
    });

    const amountMismatch =
      await processProductPaymentEvent({
        provider,
        providerEventId:
          `event-amount-${token}`,
        eventType:
          "payment.completed",
        payloadHash:
          `hash-amount-${token}`,
        payload: {
          amount:
            "14999.00",
        },
        signatureVerified:
          true,
        providerReference:
          amountReference,
        amount:
          "14999.00",
        currencyCode:
          "NGN",
        outcome:
          "SUCCEEDED",
      });

    assertCondition(
      amountMismatch
        .failureCode ===
        "AMOUNT_MISMATCH" &&
        amountMismatch
          .payment
          ?.orderStatus !==
          OrderStatus.PAID,
      "Incorrect payment amount was accepted.",
    );

    console.log(
      "PASS: Incorrect provider amount cannot mark an order paid.",
    );

    const currencyOrder =
      await createAuditOrder(
        "currency mismatch",
      );

    const currencyReference =
      `currency-${token}`;

    await initiateProductPayment({
      storefrontCode:
        "ATI",
      userId:
        user.id,
      orderNumber:
        currencyOrder
          .orderNumber,
      provider,
      providerReference:
        currencyReference,
      idempotencyKey:
        `init-currency-${token}`,
      method:
        OrderPaymentMethod.CARD,
    });

    const currencyMismatch =
      await processProductPaymentEvent({
        provider,
        providerEventId:
          `event-currency-${token}`,
        eventType:
          "payment.completed",
        payloadHash:
          `hash-currency-${token}`,
        payload: {
          amount:
            "15000.00",
          currency:
            "QAR",
        },
        signatureVerified:
          true,
        providerReference:
          currencyReference,
        amount:
          "15000.00",
        currencyCode:
          "QAR",
        outcome:
          "SUCCEEDED",
      });

    assertCondition(
      currencyMismatch
        .failureCode ===
        "CURRENCY_MISMATCH" &&
        currencyMismatch
          .payment
          ?.orderStatus !==
          OrderStatus.PAID,
      "Incorrect payment currency was accepted.",
    );

    console.log(
      "PASS: Incorrect provider currency cannot mark an order paid.",
    );

    const unverified =
      await processProductPaymentEvent({
        provider,
        providerEventId:
          `event-unverified-${token}`,
        eventType:
          "payment.completed",
        payloadHash:
          `hash-unverified-${token}`,
        payload: {
          unverified: true,
        },
        signatureVerified:
          false,
        providerReference:
          currencyReference,
        amount:
          "15000.00",
        currencyCode:
          "NGN",
        outcome:
          "SUCCEEDED",
      });

    assertCondition(
      unverified
        .disposition ===
        "REJECTED" &&
        unverified
          .failureCode ===
          "SIGNATURE_NOT_VERIFIED",
      "Unverified provider event was accepted.",
    );

    const unmatched =
      await processProductPaymentEvent({
        provider,
        providerEventId:
          `event-unmatched-${token}`,
        eventType:
          "payment.completed",
        payloadHash:
          `hash-unmatched-${token}`,
        payload: {
          unmatched: true,
        },
        signatureVerified:
          true,
        providerReference:
          `missing-${token}`,
        amount:
          "15000.00",
        currencyCode:
          "NGN",
        outcome:
          "SUCCEEDED",
      });

    assertCondition(
      unmatched
        .disposition ===
        "IGNORED" &&
        unmatched.failureCode ===
          "PAYMENT_NOT_FOUND",
      "Unmatched provider event was not safely ignored.",
    );

    console.log(
      "PASS: Unverified events are rejected and unmatched events are safely ignored.",
    );

    const inventoryAfterFailures =
      await prisma.inventory
        .findFirstOrThrow({
          where: {
            productVariantId:
              product.variantId,
          },
        });

    assertCondition(
      inventoryAfterFailures
        .quantityReserved ===
        baselineReserved + 4,
      "Payment failure or verification checks changed reserved inventory.",
    );

    console.log(
      "PASS: Processing, success and failure transitions never mutate inventory reservations.",
    );

    console.log(
      "PASS: Provider-neutral product payment transition audit completed.",
    );
  } finally {
    await prisma.paymentProviderEvent
      .deleteMany({
        where: {
          provider,
        },
      });

    if (
      variantIds.length > 0
    ) {
      await prisma.inventory
        .updateMany({
          where: {
            productVariantId: {
              in:
                variantIds,
            },
          },
          data: {
            quantityReserved:
              baselineReserved,
          },
        });
    }

    if (
      userIds.length > 0
    ) {
      await prisma.order
        .deleteMany({
          where: {
            userId: {
              in:
                userIds,
            },
          },
        });

      await prisma.cart
        .deleteMany({
          where: {
            userId: {
              in:
                userIds,
            },
          },
        });
    }

    await prisma.user
      .deleteMany({
        where: {
          id: {
            in:
              userIds,
          },
        },
      });

    if (
      productIds.length > 0
    ) {
      await prisma.product
        .deleteMany({
          where: {
            id: {
              in:
                productIds,
            },
          },
        });
    }

    const remainingEvents =
      await prisma
        .paymentProviderEvent
        .count({
          where: {
            provider,
          },
        });

    assertCondition(
      remainingEvents === 0,
      "Temporary payment transition events remain.",
    );

    console.log(
      "PASS: Temporary payment transition audit records removed.",
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
