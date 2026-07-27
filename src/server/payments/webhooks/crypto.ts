import "server-only";

import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

function constantTimeEqual(
  expected: Buffer,
  supplied: Buffer,
): boolean {
  return (
    expected.length ===
      supplied.length &&
    timingSafeEqual(
      expected,
      supplied,
    )
  );
}

export function sha256PayloadHash(
  rawBody: Uint8Array,
): string {
  return createHash(
    "sha256",
  )
    .update(
      rawBody,
    )
    .digest(
      "hex",
    );
}

export function verifyPaystackWebhookSignature(
  rawBody: Uint8Array,
  suppliedSignature:
    string |
    null,
  secretKey: string,
): boolean {
  const normalized =
    suppliedSignature
      ?.trim()
      .toLowerCase() ??
    "";

  if (
    !/^[a-f0-9]{128}$/.test(
      normalized,
    )
  ) {
    return false;
  }

  const expected =
    createHmac(
      "sha512",
      secretKey,
    )
      .update(
        rawBody,
      )
      .digest();

  return constantTimeEqual(
    expected,
    Buffer.from(
      normalized,
      "hex",
    ),
  );
}

export function verifyFlutterwaveWebhookSignature(
  rawBody: Uint8Array,
  suppliedSignature:
    string |
    null,
  secretHash: string,
): boolean {
  const normalized =
    suppliedSignature
      ?.trim() ?? "";

  if (
    normalized.length < 40 ||
    normalized.length > 100 ||
    !/^[A-Za-z0-9+/]+={0,2}$/
      .test(
        normalized,
      )
  ) {
    return false;
  }

  const expected =
    createHmac(
      "sha256",
      secretHash,
    )
      .update(
        rawBody,
      )
      .digest();

  const supplied =
    Buffer.from(
      normalized,
      "base64",
    );

  return constantTimeEqual(
    expected,
    supplied,
  );
}
