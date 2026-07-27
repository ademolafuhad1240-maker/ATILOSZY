import assert from "node:assert/strict";
import {
  access,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import {
  fileURLToPath,
} from "node:url";

const repositoryRoot =
  path.resolve(
    path.dirname(
      fileURLToPath(
        import.meta.url,
      ),
    ),
    "..",
  );

async function read(
  relativePath: string,
): Promise<string> {
  return readFile(
    path.join(
      repositoryRoot,
      relativePath,
    ),
    "utf8",
  );
}

async function doesNotExist(
  relativePath: string,
): Promise<boolean> {
  try {
    await access(
      path.join(
        repositoryRoot,
        relativePath,
      ),
    );

    return false;
  } catch {
    return true;
  }
}

async function main(): Promise<void> {
  console.log(
    "=== RAILWAY READINESS AUDIT ===",
  );

  const railway =
    JSON.parse(
      await read(
        "railway.json",
      ),
    ) as {
      $schema?: string;
      build?: {
        builder?: string;
        buildCommand?: string;
      };
      deploy?: {
        preDeployCommand?:
          string[];
        startCommand?: string;
        healthcheckPath?: string;
        healthcheckTimeout?: number;
        restartPolicyType?: string;
        restartPolicyMaxRetries?: number;
      };
    };

  assert.deepEqual(
    railway,
    {
      $schema:
        "https://railway.com/railway.schema.json",
      build: {
        builder: "RAILPACK",
        buildCommand:
          "npm run build",
      },
      deploy: {
        preDeployCommand: [
          "npm run db:deploy",
        ],
        startCommand:
          "npm run start",
        healthcheckPath:
          "/api/health/database",
        healthcheckTimeout: 300,
        restartPolicyType:
          "ON_FAILURE",
        restartPolicyMaxRetries: 3,
      },
    },
  );

  console.log(
    "PASS: Railway config uses Railpack, safe migrations, production commands and a database healthcheck.",
  );

  const packageJson =
    JSON.parse(
      await read(
        "package.json",
      ),
    ) as {
      engines?: {
        node?: string;
      };
      scripts?: {
        build?: string;
        start?: string;
        "db:deploy"?: string;
      };
    };

  assert.equal(
    packageJson.engines?.node,
    "^20.19.0 || ^22.12.0 || ^24.0.0",
  );

  assert.deepEqual(
    {
      build:
        packageJson.scripts
          ?.build,
      start:
        packageJson.scripts
          ?.start,
      deploy:
        packageJson
          .scripts?.[
            "db:deploy"
          ],
    },
    {
      build: "next build",
      start: "next start",
      deploy:
        "prisma migrate deploy",
    },
  );

  console.log(
    "PASS: Node, Next.js and Prisma commands are production-compatible.",
  );

  const prismaConfig =
    await read(
      "prisma.config.ts",
    );

  const prismaClient =
    await read(
      "src/lib/prisma.ts",
    );

  const healthRoute =
    await read(
      "src/app/api/health/database/route.ts",
    );

  assert.match(
    prismaConfig,
    /env\("DIRECT_URL"\)/,
  );

  assert.match(
    prismaClient,
    /process\.env\.DATABASE_URL/,
  );

  assert.match(
    healthRoute,
    /SELECT 1/,
  );

  assert.match(
    healthRoute,
    /status:\s*503/,
  );

  console.log(
    "PASS: Runtime and migration connections remain separate and the healthcheck fails closed.",
  );

  const environmentExample =
    await read(
      ".env.example",
    );

  for (
    const requiredVariable of [
      "DATABASE_URL=",
      "DIRECT_URL=",
      "AUTH_TOKEN_SECRET=",
      "APP_ORIGIN=",
      "AUTH_TRUSTED_ORIGINS=",
      "AUTH_REGISTRATION_API_ENABLED=false",
      "AUTH_DELIVERY_PROVIDER=disabled",
      "PAYMENT_INITIATION_PROVIDER=disabled",
      "PAYSTACK_SECRET_KEY=",
      "FLUTTERWAVE_SECRET_KEY=",
      "FLUTTERWAVE_WEBHOOK_SECRET_HASH=",
    ]
  ) {
    assert.equal(
      environmentExample.includes(
        requiredVariable,
      ),
      true,
      `Missing ${requiredVariable}`,
    );
  }

  assert.equal(
    /(?:sk_live|gh[opsu]_)[A-Za-z0-9_-]+/
      .test(
        environmentExample,
      ),
    false,
  );

  console.log(
    "PASS: Required variables use disabled defaults and contain no committed credentials.",
  );

  const guide =
    await read(
      "docs/railway-readiness.md",
    );

  for (
    const requiredGuidance of [
      "feat/commerce-foundation",
      "DATABASE_URL=${{Postgres.DATABASE_URL}}",
      "APP_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}",
      "PAYMENT_INITIATION_PROVIDER=disabled",
      "Do not connect `shop.sorvyra.com`",
    ]
  ) {
    assert.equal(
      guide.includes(
        requiredGuidance,
      ),
      true,
      `Missing Railway guidance: ${requiredGuidance}`,
    );
  }

  assert.equal(
    await doesNotExist(
      "render.yaml",
    ),
    true,
  );

  assert.equal(
    await doesNotExist(
      "render.yml",
    ),
    true,
  );

  console.log(
    "PASS: Staging and production gates are explicit and no Render configuration is present.",
  );

  console.log(
    "PASS: Railway readiness audit completed.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
