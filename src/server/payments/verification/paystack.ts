import "server-only";

import {
  OrderPaymentMethod,
} from "@/generated/prisma/client";

import {
  minorUnitsToMajorAmount,
} from "../providers/money";
import {
  PaymentVerificationError,
} from "./errors";
import {
  isVerificationObject,
  optionalVerificationText,
  requiredVerificationText,
  verificationCurrencyCode,
  verificationIdentifier,
  verificationIntegerAmount,
} from "./parsing";
import {
  getPaymentVerificationJson,
  type PaymentVerificationFetch,
} from "./transport";
import type {
  PaymentVerificationOutcome,
  PaymentVerificationProvider,
  PaymentVerificationRequest,
} from "./types";

export interface PaystackVerificationProviderOptions {
  secretKey: string;
  fetchImplementation?:
    PaymentVerificationFetch;
  timeoutMilliseconds?:
    number;
}

interface PaystackVerifiedTransaction {
  id: string;
  reference: string;
  amountMinor: string;
  currencyCode: string;
  status: string;
  channel: string | null;
}

function requireSecret(
  value: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length < 12 ||
    /\s/.test(normalized)
  ) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_CONFIGURATION_ERROR",
      "Paystack verification is not configured correctly.",
      "paystack",
    );
  }

  return normalized;
}

function transaction(
  value: unknown,
): PaystackVerifiedTransaction {
  if (!isVerificationObject(value)) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_DATA_INVALID",
      "Paystack returned invalid transaction data.",
      "paystack",
    );
  }

  const currencyCode =
    verificationCurrencyCode(
      value.currency,
      "paystack",
    );

  if (currencyCode !== "NGN") {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_DATA_INVALID",
      "Paystack returned an unsupported transaction currency.",
      "paystack",
    );
  }

  return {
    id:
      verificationIdentifier(
        value.id,
        "paystack",
      ),
    reference:
      requiredVerificationText(
        value.reference,
        191,
        "paystack",
      ),
    amountMinor:
      verificationIntegerAmount(
        value.amount,
        "paystack",
      ),
    currencyCode,
    status:
      requiredVerificationText(
        value.status,
        40,
        "paystack",
      ).toLowerCase(),
    channel:
      optionalVerificationText(
        value.channel,
        60,
      )?.toLowerCase() ??
      null,
  };
}

function outcome(
  status: string,
): PaymentVerificationOutcome {
  if (status === "success") {
    return "SUCCEEDED";
  }

  if (
    status === "failed" ||
    status === "abandoned"
  ) {
    return "FAILED";
  }

  return "PENDING";
}

function paymentMethod(
  channel: string | null,
): OrderPaymentMethod | undefined {
  switch (channel) {
    case "card":
      return OrderPaymentMethod.CARD;

    case "bank_transfer":
      return OrderPaymentMethod
        .BANK_TRANSFER;

    case "ussd":
      return OrderPaymentMethod.USSD;

    case "bank":
      return OrderPaymentMethod
        .PAY_BY_BANK;

    case "mobile_money":
    case "payattitude":
      return OrderPaymentMethod
        .PROVIDER_WALLET;

    default:
      return undefined;
  }
}

export function createPaystackPaymentVerificationProvider(
  options:
    PaystackVerificationProviderOptions,
): PaymentVerificationProvider {
  const secretKey =
    requireSecret(
      options.secretKey,
    );

  return {
    name: "paystack",

    async verify(
      request:
        PaymentVerificationRequest,
    ) {
      const providerReference =
        requiredVerificationText(
          request.providerReference,
          191,
          "paystack",
        );

      const response =
        await getPaymentVerificationJson({
          provider: "paystack",
          url:
            "https://api.paystack.co/transaction/verify/" +
            encodeURIComponent(
              providerReference,
            ),
          secretKey,
          fetchImplementation:
            options
              .fetchImplementation,
          timeoutMilliseconds:
            options
              .timeoutMilliseconds,
        });

      if (
        !isVerificationObject(
          response,
        ) ||
        response.status !== true
      ) {
        throw new PaymentVerificationError(
          "PAYMENT_VERIFICATION_DATA_INVALID",
          "Paystack returned invalid verification data.",
          "paystack",
        );
      }

      const verified =
        transaction(response.data);

      if (
        verified.reference !==
          providerReference ||
        (
          request.transactionId !==
            undefined &&
          verified.id !==
            request.transactionId
        )
      ) {
        throw new PaymentVerificationError(
          "PAYMENT_VERIFICATION_DATA_INVALID",
          "Paystack verification did not match the stored transaction.",
          "paystack",
        );
      }

      let amount: string;

      try {
        amount =
          minorUnitsToMajorAmount(
            verified.amountMinor,
            verified.currencyCode,
          );
      } catch {
        throw new PaymentVerificationError(
          "PAYMENT_VERIFICATION_DATA_INVALID",
          "Paystack returned an invalid transaction amount.",
          "paystack",
        );
      }

      const method =
        paymentMethod(
          verified.channel,
        );

      return {
        provider: "paystack",
        transactionId:
          verified.id,
        providerReference:
          verified.reference,
        amount,
        currencyCode:
          verified.currencyCode,
        providerStatus:
          verified.status,
        outcome:
          outcome(
            verified.status,
          ),
        ...(
          method === undefined
            ? {}
            : { method }
        ),
        payload: {
          source:
            "SERVER_VERIFICATION",
          transactionId:
            verified.id,
          reference:
            verified.reference,
          status:
            verified.status,
          channel:
            verified.channel,
        },
      };
    },
  };
}
