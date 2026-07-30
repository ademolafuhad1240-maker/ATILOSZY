import {
  StorefrontStaffRole,
  StorefrontStaffStatus,
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
      ? process.argv[
          index + 1
        ]
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
    value.toUpperCase();

  if (
    !/^[A-Z]{3}$/u.test(
      normalized,
    )
  ) {
    throw new Error(
      "The storefront code is invalid.",
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
      "The staff account email is invalid.",
    );
  }

  return normalized;
}

function normalizeRole(
  value: string,
): StorefrontStaffRole {
  const normalized =
    value.toUpperCase();

  if (
    normalized ===
      StorefrontStaffRole
        .FULFILMENT ||
    normalized ===
      StorefrontStaffRole
        .VIEWER
  ) {
    return normalized;
  }

  throw new Error(
    "The role must be FULFILMENT or VIEWER. Manager access requires an approved manager application.",
  );
}

async function main(): Promise<void> {
  if (
    process.env
      .STAFF_PROVISIONING_ENABLED !==
    "true"
  ) {
    throw new Error(
      "Staff provisioning is disabled. Set STAFF_PROVISIONING_ENABLED=true only for the one-off command.",
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
        normalizedEmail:
          email,
        status:
          UserStatus.ACTIVE,
        deletedAt: null,
        emailVerifiedAt: {
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
        storefrontId: true,
      },
    });

  if (!user) {
    throw new Error(
      "A verified active account was not found in that storefront.",
    );
  }

  const membership =
    await prisma
      .storefrontStaffMembership
      .upsert({
        where: {
          userId_storefrontId: {
            userId: user.id,
            storefrontId:
              user.storefrontId,
          },
        },
        create: {
          userId: user.id,
          storefrontId:
            user.storefrontId,
          role,
          status:
            StorefrontStaffStatus
              .ACTIVE,
        },
        update: {
          role,
          status:
            StorefrontStaffStatus
              .ACTIVE,
          grantedAt:
            new Date(),
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
    "Storefront staff membership provisioned.",
    {
      membershipId:
        membership.id,
      storefrontCode,
      role:
        membership.role,
      status:
        membership.status,
    },
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Staff provisioning failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
