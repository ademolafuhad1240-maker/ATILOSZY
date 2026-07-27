import "server-only";

import {
  PaymentInitiationProviderError,
} from "../initiation";

const currencyFractionDigits:
  Readonly<
    Record<string, number>
  > = {
    NGN: 2,
    QAR: 2,
  };

interface ParsedProviderAmount {
  currencyCode: string;
  majorAmount: string;
  minorAmount: string;
}

function parseProviderAmount(
  amount: string,
  currencyCode: string,
): ParsedProviderAmount {
  const normalizedCurrency =
    currencyCode
      .trim()
      .toUpperCase();

  const fractionDigits =
    currencyFractionDigits[
      normalizedCurrency
    ];

  if (
    fractionDigits ===
      undefined
  ) {
    throw new PaymentInitiationProviderError(
      "The payment currency is not supported by the configured provider.",
      {
        reason:
          "UNSUPPORTED_CURRENCY",
        currencyCode:
          normalizedCurrency,
      },
    );
  }

  const normalizedAmount =
    amount.trim();

  const match =
    /^(0|[1-9]\d*)(?:\.(\d+))?$/
      .exec(
        normalizedAmount,
      );

  if (
    !match ||
    (
      match[2]?.length ??
      0
    ) > fractionDigits
  ) {
    throw new PaymentInitiationProviderError(
      "The server-derived payment amount is invalid.",
      {
        reason:
          "INVALID_AMOUNT",
      },
    );
  }

  const whole =
    match[1];
  const fraction =
    (match[2] ?? "")
      .padEnd(
        fractionDigits,
        "0",
      );

  const minorAmount =
    BigInt(whole) *
      (
        10n **
        BigInt(
          fractionDigits,
        )
      ) +
    BigInt(
      fraction || "0",
    );

  if (
    minorAmount <= 0n
  ) {
    throw new PaymentInitiationProviderError(
      "The server-derived payment amount is invalid.",
      {
        reason:
          "INVALID_AMOUNT",
      },
    );
  }

  return {
    currencyCode:
      normalizedCurrency,
    majorAmount:
      fractionDigits === 0
        ? whole
        : `${whole}.${fraction}`,
    minorAmount:
      minorAmount.toString(),
  };
}

export function amountToMinorUnits(
  amount: string,
  currencyCode: string,
): string {
  return parseProviderAmount(
    amount,
    currencyCode,
  ).minorAmount;
}

export function normalizeProviderMajorAmount(
  amount: string,
  currencyCode: string,
): string {
  return parseProviderAmount(
    amount,
    currencyCode,
  ).majorAmount;
}

export function minorUnitsToMajorAmount(
  amount: string,
  currencyCode: string,
): string {
  const normalizedCurrency =
    currencyCode
      .trim()
      .toUpperCase();

  const fractionDigits =
    currencyFractionDigits[
      normalizedCurrency
    ];

  if (
    fractionDigits ===
      undefined
  ) {
    throw new PaymentInitiationProviderError(
      "The payment currency is not supported by the configured provider.",
      {
        reason:
          "UNSUPPORTED_CURRENCY",
        currencyCode:
          normalizedCurrency,
      },
    );
  }

  const normalizedAmount =
    amount.trim();

  if (
    !/^[1-9]\d*$/.test(
      normalizedAmount,
    )
  ) {
    throw new PaymentInitiationProviderError(
      "The server-derived payment amount is invalid.",
      {
        reason:
          "INVALID_AMOUNT",
      },
    );
  }

  if (
    fractionDigits === 0
  ) {
    return normalizedAmount;
  }

  const padded =
    normalizedAmount.padStart(
      fractionDigits + 1,
      "0",
    );

  return (
    `${padded.slice(
      0,
      -fractionDigits,
    )}.` +
    padded.slice(
      -fractionDigits,
    )
  );
}
