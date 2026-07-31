import assert from "node:assert/strict";
import sharp from "sharp";

import {
  CatalogServiceError,
} from "../src/server/catalog/errors";
import {
  createCloudinaryCatalogMediaProvider,
  getCatalogMediaCapabilities,
  issueCatalogMediaToken,
  MAX_CATALOG_IMAGE_INPUT_BYTES,
  prepareCatalogImage,
  resolveCatalogMediaProvider,
  verifyCatalogMediaToken,
} from "../src/server/catalog/media";

async function expectCatalogError(
  label: string,
  expectedCode:
    CatalogServiceError["code"],
  operation:
    () => Promise<unknown> |
      unknown,
): Promise<CatalogServiceError> {
  try {
    await operation();
  } catch (error) {
    assert.ok(
      error instanceof
        CatalogServiceError,
      `${label} did not return a catalog service error.`,
    );
    assert.equal(
      error.code,
      expectedCode,
      `${label} returned the wrong error code.`,
    );
    console.log(
      `PASS: ${label} returned ${expectedCode}.`,
    );
    return error;
  }

  assert.fail(
    `${label} did not fail closed.`,
  );
}

function cloudinarySuccessFetch(
  observedSecrets:
    string[],
): typeof fetch {
  return async (
    _input,
    init,
  ) => {
    const authorization =
      new Headers(
        init?.headers,
      ).get(
        "authorization",
      );

    if (authorization) {
      observedSecrets.push(
        authorization,
      );
    }

    assert.ok(
      init?.body instanceof
        FormData,
      "Cloudinary did not receive multipart form data.",
    );
    const publicId =
      init.body.get(
        "public_id",
      );
    assert.equal(
      typeof publicId,
      "string",
    );

    return new Response(
      JSON.stringify({
        asset_id:
          "asset-test",
        public_id: publicId,
        resource_type:
          "image",
        format: "webp",
        bytes: 412,
        width: 640,
        height: 480,
        secure_url:
          `https://res.cloudinary.com/sorvyra-test/image/upload/v1/${publicId}.webp`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/json",
        },
      },
    );
  };
}

async function main(): Promise<void> {
  console.log(
    "=== SORVYRA CATALOG MEDIA AUDIT ===",
  );

  const defaultCapabilities =
    getCatalogMediaCapabilities(
      {},
    );
  assert.equal(
    defaultCapabilities.provider,
    "disabled",
  );
  assert.equal(
    defaultCapabilities.uploadEnabled,
    false,
  );
  assert.equal(
    resolveCatalogMediaProvider(
      {},
    ).name,
    "disabled",
  );
  console.log(
    "PASS: Product photo uploads remain disabled by default.",
  );

  await expectCatalogError(
    "invalid provider configuration",
    "MEDIA_UNAVAILABLE",
    () =>
      resolveCatalogMediaProvider({
        CATALOG_MEDIA_PROVIDER:
          "unexpected-provider",
      }),
  );
  await expectCatalogError(
    "missing Cloudinary credentials",
    "MEDIA_UNAVAILABLE",
    () =>
      resolveCatalogMediaProvider({
        CATALOG_MEDIA_PROVIDER:
          "cloudinary",
      }),
  );

  const png =
    await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: {
          r: 32,
          g: 96,
          b: 88,
          alpha: 1,
        },
      },
    })
      .png()
      .toBuffer();
  const prepared =
    await prepareCatalogImage({
      bytes:
        new Uint8Array(png),
      contentType:
        "image/png",
    });
  assert.equal(
    prepared.mimeType,
    "image/webp",
  );
  assert.ok(
    prepared.byteSize > 0,
  );
  assert.ok(
    prepared.width > 0 &&
      prepared.height > 0,
  );
  console.log(
    "PASS: Valid product photos are decoded, resized safely and normalized to WebP.",
  );

  await expectCatalogError(
    "unsupported product photo type",
    "VALIDATION",
    () =>
      prepareCatalogImage({
        bytes:
          new Uint8Array(png),
        contentType:
          "image/svg+xml",
      }),
  );
  await expectCatalogError(
    "oversized product photo",
    "VALIDATION",
    () =>
      prepareCatalogImage({
        bytes:
          new Uint8Array(
            MAX_CATALOG_IMAGE_INPUT_BYTES +
              1,
          ),
        contentType:
          "image/png",
      }),
  );

  const apiSecret =
    "cloudinary-secret-never-return";
  const observedSecrets:
    string[] = [];
  const provider =
    createCloudinaryCatalogMediaProvider(
      {
        cloudName:
          "sorvyra-test",
        apiKey:
          "cloudinary-api-key",
        apiSecret,
      },
      cloudinarySuccessFetch(
        observedSecrets,
      ),
    );
  const first =
    await provider.upload({
      storefrontCode: "ATI",
      ...prepared,
    });
  const second =
    await provider.upload({
      storefrontCode: "ATI",
      ...prepared,
    });

  assert.equal(
    provider.name,
    "cloudinary",
  );
  assert.equal(
    first.provider,
    "cloudinary",
  );
  assert.equal(
    first.mimeType,
    "image/webp",
  );
  assert.ok(
    first.storageKey.startsWith(
      "sorvyra-store/ati/",
    ),
  );
  assert.notEqual(
    first.storageKey,
    second.storageKey,
  );
  assert.ok(
    observedSecrets.every(
      (header) =>
        header.startsWith(
          "Basic ",
        ) &&
        !header.includes(
          apiSecret,
        ),
    ),
  );
  assert.ok(
    !JSON.stringify(first).includes(
      apiSecret,
    ),
  );
  console.log(
    "PASS: Cloudinary uploads use authenticated server calls, unique storefront paths and normalized safe results.",
  );

  const rejectedSecret =
    "provider-raw-secret";
  const rejected =
    await expectCatalogError(
      "Cloudinary HTTP rejection",
      "MEDIA_REJECTED",
      async () =>
        createCloudinaryCatalogMediaProvider(
          {
            cloudName:
              "sorvyra-test",
            apiKey: "key",
            apiSecret,
          },
          async () =>
            new Response(
              JSON.stringify({
                error: {
                  message:
                    rejectedSecret,
                },
              }),
              {
                status: 401,
              },
            ),
        ).upload({
          storefrontCode: "ATI",
          ...prepared,
        }),
    );
  assert.ok(
    !rejected.message.includes(
      rejectedSecret,
    ),
  );
  assert.ok(
    !rejected.message.includes(
      apiSecret,
    ),
  );

  await expectCatalogError(
    "malformed Cloudinary response",
    "MEDIA_REJECTED",
    async () =>
      createCloudinaryCatalogMediaProvider(
        {
          cloudName:
            "sorvyra-test",
          apiKey: "key",
          apiSecret,
        },
        async () =>
          new Response(
            "{not-json",
            {
              status: 200,
            },
          ),
      ).upload({
        storefrontCode: "ATI",
        ...prepared,
      }),
  );

  await expectCatalogError(
    "Cloudinary network failure",
    "MEDIA_UNAVAILABLE",
    async () =>
      createCloudinaryCatalogMediaProvider(
        {
          cloudName:
            "sorvyra-test",
          apiKey: "key",
          apiSecret,
        },
        async () => {
          throw new TypeError(
            "simulated network failure",
          );
        },
      ).upload({
        storefrontCode: "ATI",
        ...prepared,
      }),
  );

  await expectCatalogError(
    "Cloudinary upload timeout",
    "MEDIA_UNAVAILABLE",
    async () =>
      createCloudinaryCatalogMediaProvider(
        {
          cloudName:
            "sorvyra-test",
          apiKey: "key",
          apiSecret,
          timeoutMs: 1_000,
        },
        async (
          _input,
          init,
        ) =>
          new Promise<Response>(
            (
              _resolve,
              reject,
            ) => {
              init?.signal
                ?.addEventListener(
                  "abort",
                  () =>
                    reject(
                      new DOMException(
                        "Aborted",
                        "AbortError",
                      ),
                    ),
                  {
                    once: true,
                  },
                );
            },
          ),
      ).upload({
        storefrontCode: "ATI",
        ...prepared,
      }),
  );

  const tokenSecret =
    "catalog-media-audit-token-secret-1234567890";
  const issued =
    issueCatalogMediaToken(
      {
        storefrontCode: "ATI",
        asset: first,
      },
      tokenSecret,
      10_000,
    );
  const verified =
    verifyCatalogMediaToken(
      issued.token,
      "ATI",
      tokenSecret,
      10_001,
    );
  assert.equal(
    verified.storageKey,
    first.storageKey,
  );
  assert.equal(
    verified.url,
    first.url,
  );
  console.log(
    "PASS: Uploaded photo metadata is protected by a short-lived attachment token.",
  );

  await expectCatalogError(
    "cross-store photo attachment",
    "VALIDATION",
    () =>
      verifyCatalogMediaToken(
        issued.token,
        "ZBF",
        tokenSecret,
        10_001,
      ),
  );
  await expectCatalogError(
    "tampered photo attachment",
    "VALIDATION",
    () =>
      verifyCatalogMediaToken(
        `${issued.token}x`,
        "ATI",
        tokenSecret,
        10_001,
      ),
  );
  await expectCatalogError(
    "expired photo attachment",
    "VALIDATION",
    () =>
      verifyCatalogMediaToken(
        issued.token,
        "ATI",
        tokenSecret,
        issued.expiresAt.getTime(),
      ),
  );

  console.log(
    "PASS: Catalog media audit completed without live provider requests.",
  );
}

main().catch(
  (error: unknown) => {
    console.error(
      "FAIL: Catalog media audit failed.",
    );
    console.error(error);
    process.exitCode = 1;
  },
);
