import "server-only";

import {
  beginProductPaymentReconciliation,
  completeProductPaymentReconciliationAttempt,
  processProductPaymentEvent,
} from "../service";
import type {
  ReconcileProductPaymentInput,
} from "../types";
import {
  resolvePaymentVerificationProvider,
} from "../verification";
import {
  reconcileProductPayment,
} from "./orchestrator";

export async function reconcileStoredProductPayment(
  input:
    ReconcileProductPaymentInput,
) {
  return reconcileProductPayment(
    input,
    {
      store: {
        begin:
          beginProductPaymentReconciliation,
        complete:
          completeProductPaymentReconciliationAttempt,
        processEvent:
          processProductPaymentEvent,
      },
      resolveProvider:
        resolvePaymentVerificationProvider,
    },
  );
}
