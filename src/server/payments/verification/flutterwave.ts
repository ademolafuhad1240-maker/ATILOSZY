import "server-only";

import {
  OrderPaymentMethod,
} from "@/generated/prisma/client";

import {
  PaymentVerificationError,
} from "./errors";
import {
  isVerificationObject,
  optionalVerificationText,
  requiredVerificationText,
  verificationCurrencyCode,
  verificationIdentifier,
  verificationMajorAmount,
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

export interface FlutterwaveVerificationProviderOptions {
  secretKey: string;
  fetchImplementation?:
    PaymentVerificationFetch;
  timeoutMilliseconds?:
    number;
}

interface FlutterwaveVerifiedTransaction {
  id: string;
  reference: string;
  amount: string;
  currencyCode: string;
  status: string;
  paymentType:
    string | null;
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
      "Flutterwave verification is not configured correctly.",
      "flutterwave",
    );
  }

  return normalized;
}

function transaction(
  value: unknown,
): FlutterwaveVerifiedTransaction {
  if (!isVerificationObject(value)) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_DATA_INVALID",
      "Flutterwave returned invalid transaction data.",
      "flutterwave",
    );
  }

  const currencyCode =
    verificationCurrencyCode(
      value.currency,
      "flutterwave",
    );

  if (
    currencyCode !== "NGN" &&
    currencyCode !== "QAR"
  ) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_DATA_INVALID",
      "Flutterwave returned an unsupported transaction currency.",
      "flutterwave",
    );
  }

  return {
    id:
      verificationIdentifier(
        value.id,
        "flutterwave",
      ),
    reference:
      requiredVerificationText(
        value.tx_ref ??
          value.reference,
        191,
        "flutterwave",
      ),
    amount:
      verificationMajorAmount(
        value.amount,
        "flutterwave",
      ),
    currencyCode,
    status:
      requiredVerificationText(
        value.status,
        40,
        "flutterwave",
      ).toLowerCase(),
    paymentType:
      optionalVerificationText(
        value.payment_type,
        80,
      )?.toLowerCase() ??
      null,
  };
}

function outcome(
  status: string,
): PaymentVerificationOutcome {
  if (
    status === "successful" ||
    status === "succeeded"
  ) {
    return "SUCCEEDED";
  }

  if (status === "failed") {
    return "FAILED";
  }

  return "PENDING";
}

function paymentMethod(
  paymentType: string | null,
): OrderPaymentMethod | undefined {
  switch (paymentType) {
    case "card":
      return OrderPaymentMethod.CARD;

    case "bank_transfer":
    case "banktransfer":
      return OrderPaymentMethod
        .BANK_TRANSFER;

    case "ussd":
      return OrderPaymentMethod.USSD;

    case "account":
      return OrderPaymentMethod
        .PAY_BY_BANK;

    case "barter":
    case "mobilemoney":
    case "mobile_money":
      return OrderPaymentMethod
        .PROVIDER_WALLET;

    default:
      return undefined;
  }
}

export function createFlutterwavePaymentVerificationProvider(
  options:
    FlutterwaveVerificationProviderOptions,
): PaymentVerificationProvider {
  const secretKey =
    requireSecret(
      options.secretKey,
    );

  return {
    name: "flutterwave",

    async verify(
      request:
        PaymentVerificationRequest,
    ) {
      const providerReference =
        requiredVerificationText(
          request.providerReference,
          191,
          "flutterwave",
        );

      const transactionId =
        request.transactionId ===
          undefined
          ? null
          : requiredVerificationText(
              request.transactionId,
              120,
              "flutterwave",
            );

      const url =
        transactionId === null
          ? "https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=" +
            encodeURIComponent(
              providerReference,
            )
          : "https://api.flutterwave.com/v3/transactions/" +
            encodeURIComponent(
              transactionId,
            ) +
            "/verify";

      const response =
        await getPaymentVerificationJson({
          provider: "flutterwave",
          url,
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
        response.status !==
          "success"
      ) {
        throw new PaymentVerificationError(
          "PAYMENT_VERIFICATION_DATA_INVALID",
          "Flutterwave returned invalid verification data.",
          "flutterwave",
        );
      }

      const verified =
        transaction(response.data);

      if (
        verified.reference !==
          providerReference ||
        (
          transactionId !== null &&
          verified.id !==
            transactionId
        )
      ) {
        throw new PaymentVerificationError(
          "PAYMENT_VERIFICATION_DATA_INVALID",
          "Flutterwave verification did not match the stored transaction.",
          "flutterwave",
        );
      }

      const method =
        paymentMethod(
          verified.paymentType,
        );

      return {
        provider: "flutterwave",
        transactionId:
          verified.id,
        providerReference:
          verified.reference,
        amount:
          verified.amount,
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
          paymentType:
            verified.paymentType,
        },
      };
    },
  };
}
