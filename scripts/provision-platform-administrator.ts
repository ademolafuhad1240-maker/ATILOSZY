import {
  PlatformAdministratorRole,
  PlatformAdministratorStatus,
  StorefrontStatus,
  UserStatus,
} from "../src/generated/prisma/client";
import {
  prisma,
} from "../src/lib/prisma";

function requiredArgument(
  name: string,
): string {
  const index =
    process.argv.indexOf(
      `--${name}`,
    );
  const value =
    index >= 0
      ? process.argv[index + 1]
      : undefined;

  if (
    !value ||
    value.startsWith("--")
  ) {
    throw new Error(
      `--${name} is required.`,
    );
  }

  return value.trim();
}

function normalizeStorefrontCode(
  value: string,
): string {
  const normalized =
    value.trim().toUpperCase();

  if (
    !/^[A-Z]{3}$/u.test(
      normalized,
    )
  ) {
    throw new Error(
      "The account storefront code is invalid.",
    );
  }

  return normalized;
}

function normalizeEmail(
  value: string,
): string {
  const normalized =
    value.trim().toLowerCase();

  if (
    normalized.length === 0 ||
    normalized.length > 254 ||
    !normalized.includes("@")
  ) {
    throw new Error(
      "The administrator account email is invalid.",
    );
  }

  return normalized;
}

function normalizeRole(
  value: string,
): PlatformAdministratorRole {
  const normalized =
    value.trim().toUpperCase();

  if (
    normalized ===
      PlatformAdministratorRole
        .OWNER ||
    normalized ===
      PlatformAdministratorRole
        .ADMIN
  ) {
    return normalized;
  }

  throw new Error(
    "The role must be OWNER or ADMIN.",
  );
}

async function main(): Promise<void> {
  if (
    process.env
      .PLATFORM_ADMIN_PROVISIONING_ENABLED !==
    "true"
  ) {
    throw new Error(
      "Platform administrator provisioning is disabled. Enable it only for this one-off command.",
    );
  }

  const storefrontCode =
    normalizeStorefrontCode(
      requiredArgument(
        "storefront",
      ),
    );
  const email =
    normalizeEmail(
      requiredArgument(
        "email",
      ),
    );
  const role =
    normalizeRole(
      requiredArgument(
        "role",
      ),
    );
  const confirmation =
    requiredArgument(
      "confirm",
    );

  if (
    confirmation !==
    `${storefrontCode}:${email}:${role}`
  ) {
    throw new Error(
      "The confirmation does not exactly match storefront:email:role.",
    );
  }

  const user =
    await prisma.user.findFirst({
      where: {
        normalizedEmail: email,
        status:
          UserStatus.ACTIVE,
        deletedAt: null,
        emailVerifiedAt: {
          not: null,
        },
        phoneVerifiedAt: {
          not: null,
        },
        storefront: {
          code: storefrontCode,
          status:
            StorefrontStatus.ACTIVE,
        },
      },
      select: {
        id: true,
      },
    });

  if (!user) {
    throw new Error(
      "A verified active account was not found in that storefront.",
    );
  }

  const administrator =
    await prisma
      .platformAdministrator
      .upsert({
        where: {
          userId: user.id,
        },
        create: {
          userId: user.id,
          role,
          status:
            PlatformAdministratorStatus
              .ACTIVE,
        },
        update: {
          role,
          status:
            PlatformAdministratorStatus
              .ACTIVE,
          grantedAt: new Date(),
          suspendedAt: null,
          revokedAt: null,
        },
        select: {
          id: true,
          role: true,
          status: true,
        },
      });

  console.log(
    "SORVYRA platform administrator provisioned.",
    {
      administratorId:
        administrator.id,
      accountStorefront:
        storefrontCode,
      role:
        administrator.role,
      status:
        administrator.status,
    },
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Platform administrator provisioning failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
