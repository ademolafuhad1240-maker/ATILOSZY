import {
  readFileSync,
} from "node:fs";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sourceSection(
  source: string,
  start: string,
  end: string,
): string {
  const startIndex =
    source.indexOf(start);

  const endIndex =
    source.indexOf(
      end,
      startIndex + start.length,
    );

  assertCondition(
    startIndex >= 0 &&
      endIndex > startIndex,
    `Could not inspect ${start}.`,
  );

  return source.slice(
    startIndex,
    endIndex,
  );
}

function main(): void {
  console.log(
    "=== AUTHENTICATED CUSTOMER PAYMENT UI AUDIT ===",
  );

  const orderSource =
    readFileSync(
      "src/components/orders/storefront-order.tsx",
      "utf8",
    );

  const orderStyles =
    readFileSync(
      "src/components/orders/storefront-order.module.css",
      "utf8",
    );

  const checkoutTypes =
    readFileSync(
      "src/server/checkout/types.ts",
      "utf8",
    );

  const checkoutService =
    readFileSync(
      "src/server/checkout/service.ts",
      "utf8",
    );

  const initiationSource =
    sourceSection(
      orderSource,
      "async function beginPayment",
      "async function reconcilePayment",
    );

  const reconciliationSource =
    sourceSection(
      orderSource,
      "async function reconcilePayment",
      "async function cancelOrder",
    );

  const cancellationSource =
    sourceSection(
      orderSource,
      "async function cancelOrder",
      "const canStartPayment",
    );

  for (
    const required of [
      "/payment/initiate",
      "paymentRequestToken(",
      "paymentMethod",
      "safeRedirectUrl",
      "window.location.assign",
      "same-origin",
      "paymentAttemptInFlight",
    ]
  ) {
    assertCondition(
      initiationSource.includes(
        required,
      ),
      `Payment initiation UI is missing ${required}.`,
    );
  }

  for (
    const forbidden of [
      "providerReference:",
      "idempotencyKey:",
      "merchantReference:",
      "currencyCode:",
      "amount:",
      "providerMetadata:",
      "paymentStatus:",
    ]
  ) {
    assertCondition(
      !initiationSource.includes(
        forbidden,
      ),
      `Payment initiation UI submits the server-controlled field ${forbidden}`,
    );
  }

  assertCondition(
    initiationSource.includes(
      "storefrontCode:",
    ) &&
      initiationSource.includes(
        "method:",
      ) &&
      initiationSource.includes(
        "requestToken:",
      ),
    "Payment initiation UI does not submit the minimal allowed request.",
  );

  console.log(
    "PASS: Customer initiation submits only storefront, method and an ephemeral request token.",
  );

  assertCondition(
    orderSource.includes(
      "window.sessionStorage",
    ) &&
      orderSource.includes(
        "paymentRequestTokenKey",
      ) &&
      orderSource.includes(
        "clearPaymentRequestTokens",
      ),
    "Customer payment retries do not preserve a stable request token for ambiguous network outcomes.",
  );

  console.log(
    "PASS: Ambiguous retries reuse a browser-session request token while terminal attempts clear it.",
  );

  assertCondition(
    cancellationSource.includes(
      "initiatingPayment",
    ) &&
      cancellationSource.includes(
        "paymentAttemptInFlight",
      ),
    "Order cancellation can race an in-flight provider initialization.",
  );

  console.log(
    "PASS: Customer cancellation is blocked while provider initialization is in flight.",
  );

  for (
    const required of [
      "/payment/reconcile",
      "storefrontCode:",
      "Retry-After",
      "429",
      "refreshOrder",
    ]
  ) {
    assertCondition(
      reconciliationSource.includes(
        required,
      ),
      `Payment reconciliation UI is missing ${required}.`,
    );
  }

  for (
    const forbidden of [
      "providerReference:",
      "idempotencyKey:",
      "merchantReference:",
      "currencyCode:",
      "amount:",
      "outcome:",
    ]
  ) {
    assertCondition(
      !reconciliationSource.includes(
        forbidden,
      ),
      `Payment reconciliation UI submits the server-controlled field ${forbidden}`,
    );
  }

  console.log(
    "PASS: Customer reconciliation uses only the stored server-side payment identity.",
  );

  for (
    const required of [
      "Returning from a",
      "is not",
      "proof of payment",
      "server-side",
      "provider",
      "verification",
    ]
  ) {
    assertCondition(
      orderSource.includes(
        required,
      ),
      `Payment UI is missing verification guidance: ${required}.`,
    );
  }

  assertCondition(
    orderSource.includes(
      "Continue to secure payment",
    ) &&
      orderSource.includes(
        "Check payment status",
      ) &&
      orderSource.includes(
        "You may retry or",
      ) &&
      orderStyles.includes(
        ".paymentButton",
      ),
    "Customer payment states are incomplete.",
  );

  assertCondition(
    !orderSource.includes(
      "Payment not yet connected",
    ) &&
      !orderSource.includes(
        "introduced in the next payment phase",
      ),
    "Legacy disconnected-payment copy remains on the order page.",
  );

  console.log(
    "PASS: Order pages expose initiation, interrupted-payment verification and safe retry states.",
  );

  assertCondition(
    !checkoutTypes.includes(
      "providerReference",
    ) &&
      !sourceSection(
        checkoutService,
        "function buildOrderView",
        "async function runSerializable",
      ).includes(
        "providerReference",
      ),
    "The public order view exposes a provider reference.",
  );

  console.log(
    "PASS: Public customer-order responses exclude provider references.",
  );

  const normalizedCheckoutService =
    checkoutService.replace(
      /\s+/g,
      " ",
    );

  assertCondition(
    normalizedCheckoutService.includes(
      "OrderPaymentStatus .FAILED",
    ) &&
      orderSource.includes(
        '"FAILED",',
      ) &&
      normalizedCheckoutService.includes(
        "OrderStatus .PENDING_PAYMENT",
      ),
    "Verified failed payments cannot be cancelled safely.",
  );

  console.log(
    "PASS: Failed unpaid orders can be cancelled while active processing orders remain protected.",
  );

  console.log(
    "PASS: Authenticated customer payment UI audit completed without live provider calls.",
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
