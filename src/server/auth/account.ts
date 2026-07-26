import "server-only";

import { prisma } from "../../lib/prisma";

import { AuthServiceError } from "./errors";

export interface CustomerAccountSummary {
  userId: string;
  storefrontId: string;
  email: string;
  phone: string;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string | null;
    marketingOptIn: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    loginAlertsEnabled: boolean;
  };
}

export async function getCustomerAccountSummary(
  input: {
    userId: string;
    storefrontId: string;
  },
): Promise<CustomerAccountSummary> {
  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      storefrontId: input.storefrontId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      storefrontId: true,
      email: true,
      phone: true,
      status: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
      lastLoginAt: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          marketingOptIn: true,
        },
      },
      security: {
        select: {
          twoFactorEnabled: true,
          loginAlertsEnabled: true,
        },
      },
    },
  });

  if (
    !user ||
    !user.customer ||
    !user.security ||
    user.emailVerifiedAt === null ||
    user.phoneVerifiedAt === null
  ) {
    throw new AuthServiceError(
      "ACCOUNT_UNAVAILABLE",
      "The account is unavailable.",
    );
  }

  return {
    userId: user.id,
    storefrontId: user.storefrontId,
    email: user.email,
    phone: user.phone,
    status: user.status,
    emailVerified:
      user.emailVerifiedAt !== null,
    phoneVerified:
      user.phoneVerifiedAt !== null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    profile: {
      firstName:
        user.customer.firstName,
      lastName:
        user.customer.lastName,
      displayName:
        user.customer.displayName,
      marketingOptIn:
        user.customer.marketingOptIn,
    },
    security: {
      twoFactorEnabled:
        user.security.twoFactorEnabled,
      loginAlertsEnabled:
        user.security.loginAlertsEnabled,
    },
  };
}
