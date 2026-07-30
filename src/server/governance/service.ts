import "server-only";

import {
  GovernanceAction,
  GovernanceActorKind,
  ManagerApplicationStatus,
  PlatformAdministratorStatus,
  Prisma,
  StorefrontStaffRole,
  StorefrontStaffStatus,
  StorefrontStatus,
  UserStatus,
} from "@/generated/prisma/client";
import {
  prisma,
} from "@/lib/prisma";
import {
  normalizeEmail,
} from "@/server/auth/crypto";

import {
  GovernanceServiceError,
  isPrismaErrorCode,
} from "./errors";
import type {
  AdminApplicationView,
  AdminGovernanceView,
  AdminManagerView,
  ManagerApplicationDecision,
  ManagerApplicationView,
  ManagerPortalView,
  ManagerStatusAction,
  StaffMembershipView,
  StorefrontStaffAction,
} from "./types";
import {
  normalizeDelegatedStaffRole,
  normalizeIdentifier,
  normalizeNote,
  normalizeStatement,
  normalizeStorefrontCode,
} from "./validation";

interface ActiveAccount {
  id: string;
  storefrontId: string;
  email: string;
  phone: string;
  name: string;
}

interface PlatformContext {
  id: string;
  userId: string;
  email: string;
  role: "OWNER" | "ADMIN";
}

interface ManagerContext {
  membershipId: string;
  userId: string;
  storefrontId: string;
  storefrontCode: string;
  email: string;
}

function accountName(
  account: {
    email: string;
    customer: {
      firstName: string;
      lastName: string;
      displayName:
        | string
        | null;
    } | null;
  },
): string {
  const displayName =
    account.customer
      ?.displayName
      ?.trim();

  if (displayName) {
    return displayName;
  }

  const legalName = [
    account.customer?.firstName,
    account.customer?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    legalName ||
    account.email.split("@")[0] ||
    "Storefront account"
  );
}

function applicationView(
  application: {
    id: string;
    status:
      ManagerApplicationStatus;
    statement: string;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewNote: string | null;
  },
): ManagerApplicationView {
  return {
    id: application.id,
    status: application.status,
    statement:
      application.statement,
    submittedAt:
      application.submittedAt
        .toISOString(),
    reviewedAt:
      application.reviewedAt
        ?.toISOString() ?? null,
    reviewNote:
      application.reviewNote,
  };
}

function staffView(
  membership: {
    id: string;
    role: StorefrontStaffRole;
    status:
      StorefrontStaffStatus;
    grantedAt: Date;
    user: {
      email: string;
      customer: {
        firstName: string;
        lastName: string;
        displayName:
          | string
          | null;
      } | null;
    };
  },
): StaffMembershipView {
  return {
    id: membership.id,
    email: membership.user.email,
    name: accountName(
      membership.user,
    ),
    role: membership.role,
    status: membership.status,
    grantedAt:
      membership.grantedAt
        .toISOString(),
  };
}

async function runSerializable<T>(
  operation: (
    transaction:
      Prisma.TransactionClient,
  ) => Promise<T>,
): Promise<T> {
  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    try {
      return await prisma.$transaction(
        operation,
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,
        },
      );
    } catch (error) {
      if (
        attempt < 3 &&
        isPrismaErrorCode(
          error,
          "P2034",
        )
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new GovernanceServiceError(
    "GOVERNANCE_CONFLICT",
    "The governance operation could not be completed safely.",
  );
}

async function resolveActiveAccount(
  transaction:
    Prisma.TransactionClient,
  storefrontCodeValue: string,
  userIdValue: string,
): Promise<{
  account: ActiveAccount;
  storefront: {
    id: string;
    code: string;
    name: string;
  };
}> {
  const storefrontCode =
    normalizeStorefrontCode(
      storefrontCodeValue,
    );
  const userId =
    normalizeIdentifier(
      userIdValue,
      "User identity",
    );

  const storefront =
    await transaction.storefront
      .findUnique({
        where: {
          code: storefrontCode,
        },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
      });

  if (
    !storefront ||
    storefront.status !==
      StorefrontStatus.ACTIVE
  ) {
    throw new GovernanceServiceError(
      "STOREFRONT_UNAVAILABLE",
      "The selected storefront is unavailable.",
    );
  }

  const user =
    await transaction.user.findFirst({
      where: {
        id: userId,
        storefrontId:
          storefront.id,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: {
          not: null,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        storefrontId: true,
        email: true,
        phone: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });

  if (!user) {
    throw new GovernanceServiceError(
      "ACCOUNT_UNAVAILABLE",
      "A verified active storefront account is required.",
    );
  }

  return {
    account: {
      id: user.id,
      storefrontId:
        user.storefrontId,
      email: user.email,
      phone: user.phone,
      name: accountName(user),
    },
    storefront: {
      id: storefront.id,
      code: storefront.code,
      name: storefront.name,
    },
  };
}

async function resolvePlatformContext(
  transaction:
    Prisma.TransactionClient,
  userIdValue: string,
): Promise<PlatformContext> {
  const userId =
    normalizeIdentifier(
      userIdValue,
      "Administrator identity",
    );

  const administrator =
    await transaction
      .platformAdministrator
      .findUnique({
        where: {
          userId,
        },
        select: {
          id: true,
          userId: true,
          role: true,
          status: true,
          user: {
            select: {
              email: true,
              status: true,
              emailVerifiedAt: true,
              phoneVerifiedAt: true,
              deletedAt: true,
            },
          },
        },
      });

  if (
    !administrator ||
    administrator.status !==
      PlatformAdministratorStatus
        .ACTIVE ||
    administrator.user.status !==
      UserStatus.ACTIVE ||
    administrator.user
        .emailVerifiedAt === null ||
    administrator.user
        .deletedAt !== null
  ) {
    throw new GovernanceServiceError(
      "PLATFORM_ACCESS_REQUIRED",
      "Active SORVYRA administrator access is required.",
    );
  }

  return {
    id: administrator.id,
    userId: administrator.userId,
    email:
      administrator.user.email,
    role: administrator.role,
  };
}

async function resolveManagerContext(
  transaction:
    Prisma.TransactionClient,
  storefrontCode: string,
  userId: string,
): Promise<ManagerContext> {
  const resolved =
    await resolveActiveAccount(
      transaction,
      storefrontCode,
      userId,
    );

  const membership =
    await transaction
      .storefrontStaffMembership
      .findUnique({
        where: {
          userId_storefrontId: {
            userId:
              resolved.account.id,
            storefrontId:
              resolved.storefront.id,
          },
        },
        select: {
          id: true,
          role: true,
          status: true,
        },
      });

  if (
    !membership ||
    membership.role !==
      StorefrontStaffRole.MANAGER ||
    membership.status !==
      StorefrontStaffStatus.ACTIVE
  ) {
    throw new GovernanceServiceError(
      "MANAGER_ACCESS_REQUIRED",
      "Active manager access is required for this storefront.",
    );
  }

  return {
    membershipId: membership.id,
    userId: resolved.account.id,
    storefrontId:
      resolved.storefront.id,
    storefrontCode:
      resolved.storefront.code,
    email: resolved.account.email,
  };
}

export async function getManagerPortal(
  input: {
    storefrontCode: string;
    userId: string;
  },
): Promise<ManagerPortalView> {
  return prisma.$transaction(
    async (transaction) => {
      const resolved =
        await resolveActiveAccount(
          transaction,
          input.storefrontCode,
          input.userId,
        );

      const [
        membership,
        latestApplication,
      ] = await Promise.all([
        transaction
          .storefrontStaffMembership
          .findUnique({
            where: {
              userId_storefrontId: {
                userId:
                  resolved.account.id,
                storefrontId:
                  resolved.storefront.id,
              },
            },
            select: {
              role: true,
              status: true,
            },
          }),
        transaction
          .managerApplication
          .findFirst({
            where: {
              applicantUserId:
                resolved.account.id,
              storefrontId:
                resolved.storefront.id,
            },
            orderBy: {
              submittedAt: "desc",
            },
            select: {
              id: true,
              status: true,
              statement: true,
              submittedAt: true,
              reviewedAt: true,
              reviewNote: true,
            },
          }),
      ]);

      const canManageStaff =
        membership?.role ===
          StorefrontStaffRole
            .MANAGER &&
        membership.status ===
          StorefrontStaffStatus
            .ACTIVE;

      const staff = canManageStaff
        ? await transaction
            .storefrontStaffMembership
            .findMany({
              where: {
                storefrontId:
                  resolved
                    .storefront.id,
              },
              select: {
                id: true,
                role: true,
                status: true,
                grantedAt: true,
                user: {
                  select: {
                    email: true,
                    customer: {
                      select: {
                        firstName: true,
                        lastName: true,
                        displayName: true,
                      },
                    },
                  },
                },
              },
              orderBy: [
                {
                  role: "asc",
                },
                {
                  grantedAt: "asc",
                },
              ],
            })
        : [];

      return {
        account: {
          email:
            resolved.account.email,
          name:
            resolved.account.name,
        },
        storefront: {
          code:
            resolved.storefront.code,
          name:
            resolved.storefront.name,
        },
        membership: membership
          ? {
              role: membership.role,
              status:
                membership.status,
            }
          : null,
        latestApplication:
          latestApplication
            ? applicationView(
                latestApplication,
              )
            : null,
        staff:
          staff.map(staffView),
      };
    },
  );
}

export async function submitManagerApplication(
  input: {
    storefrontCode: string;
    userId: string;
    statement: string;
  },
): Promise<ManagerApplicationView> {
  const statement =
    normalizeStatement(
      input.statement,
    );

  try {
    return await runSerializable(
      async (transaction) => {
        const resolved =
          await resolveActiveAccount(
            transaction,
            input.storefrontCode,
            input.userId,
          );

        const membership =
          await transaction
            .storefrontStaffMembership
            .findUnique({
              where: {
                userId_storefrontId: {
                  userId:
                    resolved.account.id,
                  storefrontId:
                    resolved
                      .storefront.id,
                },
              },
              select: {
                role: true,
                status: true,
              },
            });

        if (
          membership?.role ===
            StorefrontStaffRole
              .MANAGER &&
          membership.status ===
            StorefrontStaffStatus
              .ACTIVE
        ) {
          throw new GovernanceServiceError(
            "MANAGER_ACCESS_EXISTS",
            "This account already has active manager access.",
          );
        }

        const pending =
          await transaction
            .managerApplication
            .findFirst({
              where: {
                applicantUserId:
                  resolved.account.id,
                storefrontId:
                  resolved
                    .storefront.id,
                status:
                  ManagerApplicationStatus
                    .PENDING,
              },
              select: {
                id: true,
              },
            });

        if (pending) {
          throw new GovernanceServiceError(
            "APPLICATION_ALREADY_PENDING",
            "A manager application is already awaiting review for this storefront.",
          );
        }

        const application =
          await transaction
            .managerApplication.create({
              data: {
                applicantUserId:
                  resolved.account.id,
                storefrontId:
                  resolved
                    .storefront.id,
                statement,
              },
              select: {
                id: true,
                status: true,
                statement: true,
                submittedAt: true,
                reviewedAt: true,
                reviewNote: true,
              },
            });

        await transaction
          .governanceAuditEvent
          .create({
            data: {
              storefrontId:
                resolved.storefront.id,
              managerApplicationId:
                application.id,
              actorUserId:
                resolved.account.id,
              actorKind:
                GovernanceActorKind
                  .APPLICANT,
              actorEmail:
                resolved.account.email,
              action:
                GovernanceAction
                  .MANAGER_APPLICATION_SUBMITTED,
              targetUserId:
                resolved.account.id,
              targetEmail:
                resolved.account.email,
              toValue:
                ManagerApplicationStatus
                  .PENDING,
            },
          });

        return applicationView(
          application,
        );
      },
    );
  } catch (error) {
    if (
      isPrismaErrorCode(
        error,
        "P2002",
      )
    ) {
      throw new GovernanceServiceError(
        "APPLICATION_ALREADY_PENDING",
        "A manager application is already awaiting review for this storefront.",
      );
    }

    throw error;
  }
}

export async function withdrawManagerApplication(
  input: {
    storefrontCode: string;
    userId: string;
    applicationId: string;
  },
): Promise<ManagerApplicationView> {
  const applicationId =
    normalizeIdentifier(
      input.applicationId,
      "Application",
    );

  return runSerializable(
    async (transaction) => {
      const resolved =
        await resolveActiveAccount(
          transaction,
          input.storefrontCode,
          input.userId,
        );

      const locked =
        await transaction.$queryRaw<
          Array<{
            id: string;
          }>
        >(Prisma.sql`
          SELECT id
          FROM manager_applications
          WHERE
            id = ${applicationId}
            AND "applicantUserId" =
              ${resolved.account.id}
            AND "storefrontId" =
              ${resolved.storefront.id}
          FOR UPDATE
        `);

      if (locked.length !== 1) {
        throw new GovernanceServiceError(
          "APPLICATION_NOT_FOUND",
          "The manager application was not found.",
        );
      }

      const application =
        await transaction
          .managerApplication
          .findUniqueOrThrow({
            where: {
              id: applicationId,
            },
            select: {
              status: true,
            },
          });

      if (
        application.status !==
        ManagerApplicationStatus
          .PENDING
      ) {
        throw new GovernanceServiceError(
          "APPLICATION_NOT_PENDING",
          "Only a pending application can be withdrawn.",
        );
      }

      const changedAt = new Date();
      const updated =
        await transaction
          .managerApplication.update({
            where: {
              id: applicationId,
            },
            data: {
              status:
                ManagerApplicationStatus
                  .WITHDRAWN,
              withdrawnAt: changedAt,
            },
            select: {
              id: true,
              status: true,
              statement: true,
              submittedAt: true,
              reviewedAt: true,
              reviewNote: true,
            },
          });

      await transaction
        .governanceAuditEvent.create({
          data: {
            storefrontId:
              resolved.storefront.id,
            managerApplicationId:
              applicationId,
            actorUserId:
              resolved.account.id,
            actorKind:
              GovernanceActorKind
                .APPLICANT,
            actorEmail:
              resolved.account.email,
            action:
              GovernanceAction
                .MANAGER_APPLICATION_WITHDRAWN,
            targetUserId:
              resolved.account.id,
            targetEmail:
              resolved.account.email,
            fromValue:
              ManagerApplicationStatus
                .PENDING,
            toValue:
              ManagerApplicationStatus
                .WITHDRAWN,
          },
        });

      return applicationView(
        updated,
      );
    },
  );
}

function adminApplicationView(
  application: {
    id: string;
    status:
      ManagerApplicationStatus;
    statement: string;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewNote: string | null;
    storefront: {
      code: string;
      name: string;
    };
    applicant: {
      email: string;
      phone: string;
      customer: {
        firstName: string;
        lastName: string;
        displayName:
          | string
          | null;
      } | null;
    };
  },
): AdminApplicationView {
  return {
    ...applicationView(
      application,
    ),
    storefront:
      application.storefront,
    applicant: {
      email:
        application.applicant.email,
      phone:
        application.applicant.phone,
      name: accountName(
        application.applicant,
      ),
    },
  };
}

function adminManagerView(
  membership: {
    id: string;
    status:
      StorefrontStaffStatus;
    grantedAt: Date;
    storefront: {
      code: string;
      name: string;
    };
    user: {
      email: string;
      customer: {
        firstName: string;
        lastName: string;
        displayName:
          | string
          | null;
      } | null;
    };
  },
): AdminManagerView {
  return {
    membershipId:
      membership.id,
    storefront:
      membership.storefront,
    manager: {
      email: membership.user.email,
      name: accountName(
        membership.user,
      ),
    },
    status: membership.status,
    grantedAt:
      membership.grantedAt
        .toISOString(),
  };
}

export async function getAdminGovernanceView(
  input: {
    userId: string;
  },
): Promise<AdminGovernanceView> {
  return prisma.$transaction(
    async (transaction) => {
      const administrator =
        await resolvePlatformContext(
          transaction,
          input.userId,
        );

      const [
        applications,
        managers,
      ] = await Promise.all([
        transaction
          .managerApplication
          .findMany({
            take: 100,
            orderBy: [
              {
                status: "asc",
              },
              {
                submittedAt: "desc",
              },
            ],
            select: {
              id: true,
              status: true,
              statement: true,
              submittedAt: true,
              reviewedAt: true,
              reviewNote: true,
              storefront: {
                select: {
                  code: true,
                  name: true,
                },
              },
              applicant: {
                select: {
                  email: true,
                  phone: true,
                  customer: {
                    select: {
                      firstName: true,
                      lastName: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          }),
        transaction
          .storefrontStaffMembership
          .findMany({
            where: {
              role:
                StorefrontStaffRole
                  .MANAGER,
            },
            orderBy: [
              {
                storefront: {
                  code: "asc",
                },
              },
              {
                grantedAt: "asc",
              },
            ],
            select: {
              id: true,
              status: true,
              grantedAt: true,
              storefront: {
                select: {
                  code: true,
                  name: true,
                },
              },
              user: {
                select: {
                  email: true,
                  customer: {
                    select: {
                      firstName: true,
                      lastName: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          }),
      ]);

      return {
        administrator: {
          role:
            administrator.role,
          email:
            administrator.email,
        },
        applications:
          applications.map(
            adminApplicationView,
          ),
        managers:
          managers.map(
            adminManagerView,
          ),
      };
    },
  );
}

export async function reviewManagerApplication(
  input: {
    administratorUserId: string;
    applicationId: string;
    decision:
      ManagerApplicationDecision;
    note?:
      | string
      | null;
  },
): Promise<AdminApplicationView> {
  const applicationId =
    normalizeIdentifier(
      input.applicationId,
      "Application",
    );
  const note = normalizeNote(
    input.note,
  );

  return runSerializable(
    async (transaction) => {
      const administrator =
        await resolvePlatformContext(
          transaction,
          input.administratorUserId,
        );

      const locked =
        await transaction.$queryRaw<
          Array<{
            id: string;
          }>
        >(Prisma.sql`
          SELECT id
          FROM manager_applications
          WHERE id = ${applicationId}
          FOR UPDATE
        `);

      if (locked.length !== 1) {
        throw new GovernanceServiceError(
          "APPLICATION_NOT_FOUND",
          "The manager application was not found.",
        );
      }

      const application =
        await transaction
          .managerApplication
          .findUniqueOrThrow({
            where: {
              id: applicationId,
            },
            select: {
              id: true,
              applicantUserId: true,
              storefrontId: true,
              status: true,
              applicant: {
                select: {
                  email: true,
                },
              },
            },
          });

      if (
        application.status !==
        ManagerApplicationStatus
          .PENDING
      ) {
        throw new GovernanceServiceError(
          "APPLICATION_NOT_PENDING",
          "This application has already been resolved.",
        );
      }

      if (
        application.applicantUserId ===
        administrator.userId
      ) {
        throw new GovernanceServiceError(
          "APPLICATION_SELF_REVIEW_FORBIDDEN",
          "Administrators cannot review their own manager application.",
        );
      }

      const approved =
        input.decision ===
        "APPROVE";
      const changedAt = new Date();

      if (approved) {
        await transaction
          .storefrontStaffMembership
          .upsert({
            where: {
              userId_storefrontId: {
                userId:
                  application
                    .applicantUserId,
                storefrontId:
                  application
                    .storefrontId,
              },
            },
            create: {
              userId:
                application
                  .applicantUserId,
              storefrontId:
                application
                  .storefrontId,
              role:
                StorefrontStaffRole
                  .MANAGER,
              status:
                StorefrontStaffStatus
                  .ACTIVE,
              grantedAt: changedAt,
            },
            update: {
              role:
                StorefrontStaffRole
                  .MANAGER,
              status:
                StorefrontStaffStatus
                  .ACTIVE,
              grantedAt: changedAt,
              suspendedAt: null,
              revokedAt: null,
            },
          });
      }

      await transaction
        .managerApplication.update({
          where: {
            id: application.id,
          },
          data: {
            status: approved
              ? ManagerApplicationStatus
                  .APPROVED
              : ManagerApplicationStatus
                  .REJECTED,
            reviewedAt: changedAt,
            reviewedByAdministratorId:
              administrator.id,
            reviewNote: note,
          },
        });

      await transaction
        .governanceAuditEvent.create({
          data: {
            storefrontId:
              application.storefrontId,
            managerApplicationId:
              application.id,
            actorUserId:
              administrator.userId,
            actorKind:
              GovernanceActorKind
                .PLATFORM_ADMINISTRATOR,
            actorEmail:
              administrator.email,
            action: approved
              ? GovernanceAction
                  .MANAGER_APPLICATION_APPROVED
              : GovernanceAction
                  .MANAGER_APPLICATION_REJECTED,
            targetUserId:
              application
                .applicantUserId,
            targetEmail:
              application
                .applicant.email,
            fromValue:
              ManagerApplicationStatus
                .PENDING,
            toValue: approved
              ? ManagerApplicationStatus
                  .APPROVED
              : ManagerApplicationStatus
                  .REJECTED,
            note,
          },
        });

      const updated =
        await transaction
          .managerApplication
          .findUniqueOrThrow({
            where: {
              id: application.id,
            },
            select: {
              id: true,
              status: true,
              statement: true,
              submittedAt: true,
              reviewedAt: true,
              reviewNote: true,
              storefront: {
                select: {
                  code: true,
                  name: true,
                },
              },
              applicant: {
                select: {
                  email: true,
                  phone: true,
                  customer: {
                    select: {
                      firstName: true,
                      lastName: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          });

      return adminApplicationView(
        updated,
      );
    },
  );
}

function staffAuditAction(
  action: StorefrontStaffAction,
): GovernanceAction {
  switch (action) {
    case "GRANT":
      return GovernanceAction
        .STAFF_ACCESS_GRANTED;
    case "CHANGE_ROLE":
      return GovernanceAction
        .STAFF_ROLE_CHANGED;
    case "SUSPEND":
      return GovernanceAction
        .STAFF_SUSPENDED;
    case "REACTIVATE":
      return GovernanceAction
        .STAFF_REACTIVATED;
    case "REVOKE":
      return GovernanceAction
        .STAFF_REVOKED;
  }
}

export async function manageStorefrontStaff(
  input: {
    storefrontCode: string;
    managerUserId: string;
    targetEmail: string;
    action:
      StorefrontStaffAction;
    role?:
      | string
      | null;
    note?:
      | string
      | null;
  },
): Promise<StaffMembershipView> {
  const targetEmail =
    normalizeEmail(
      input.targetEmail,
    );
  const note = normalizeNote(
    input.note,
  );
  const delegatedRole =
    input.action === "GRANT" ||
    input.action ===
      "CHANGE_ROLE"
      ? normalizeDelegatedStaffRole(
          input.role,
        )
      : null;

  return runSerializable(
    async (transaction) => {
      const manager =
        await resolveManagerContext(
          transaction,
          input.storefrontCode,
          input.managerUserId,
        );

      const target =
        await transaction.user
          .findUnique({
            where: {
              storefrontId_normalizedEmail:
                {
                  storefrontId:
                    manager.storefrontId,
                  normalizedEmail:
                    targetEmail,
                },
            },
            select: {
              id: true,
              email: true,
              status: true,
              emailVerifiedAt: true,
              phoneVerifiedAt: true,
              deletedAt: true,
            },
          });

      if (
        !target ||
        target.status !==
          UserStatus.ACTIVE ||
        target.emailVerifiedAt ===
          null ||
        target.deletedAt !== null
      ) {
        throw new GovernanceServiceError(
          "STAFF_TARGET_NOT_FOUND",
          "A verified active account was not found in this storefront.",
        );
      }

      if (
        target.id === manager.userId
      ) {
        throw new GovernanceServiceError(
          "STAFF_TARGET_PROTECTED",
          "Managers cannot change their own access.",
        );
      }

      const existing =
        await transaction
          .storefrontStaffMembership
          .findUnique({
            where: {
              userId_storefrontId: {
                userId: target.id,
                storefrontId:
                  manager.storefrontId,
              },
            },
            select: {
              id: true,
              role: true,
              status: true,
            },
          });

      if (
        existing?.role ===
        StorefrontStaffRole.MANAGER
      ) {
        throw new GovernanceServiceError(
          "STAFF_TARGET_PROTECTED",
          "Manager access can be changed only by a SORVYRA administrator.",
        );
      }

      const changedAt = new Date();
      let fromValue: string | null =
        existing
          ? `${existing.role}:${existing.status}`
          : null;

      if (
        input.action === "GRANT"
      ) {
        if (
          existing?.status ===
          StorefrontStaffStatus.ACTIVE
        ) {
          throw new GovernanceServiceError(
            "INVALID_STAFF_ACTION",
            "This account already has active staff access.",
          );
        }

        await transaction
          .storefrontStaffMembership
          .upsert({
            where: {
              userId_storefrontId: {
                userId: target.id,
                storefrontId:
                  manager.storefrontId,
              },
            },
            create: {
              userId: target.id,
              storefrontId:
                manager.storefrontId,
              role:
                delegatedRole!,
              status:
                StorefrontStaffStatus
                  .ACTIVE,
              grantedAt: changedAt,
            },
            update: {
              role:
                delegatedRole!,
              status:
                StorefrontStaffStatus
                  .ACTIVE,
              grantedAt: changedAt,
              suspendedAt: null,
              revokedAt: null,
            },
          });
      } else {
        if (!existing) {
          throw new GovernanceServiceError(
            "STAFF_TARGET_NOT_FOUND",
            "This account does not have staff access.",
          );
        }

        switch (input.action) {
          case "CHANGE_ROLE":
            if (
              existing.status !==
                StorefrontStaffStatus
                  .ACTIVE ||
              existing.role ===
                delegatedRole
            ) {
              throw new GovernanceServiceError(
                "INVALID_STAFF_ACTION",
                "The requested staff role change is unavailable.",
              );
            }

            await transaction
              .storefrontStaffMembership
              .update({
                where: {
                  id: existing.id,
                },
                data: {
                  role:
                    delegatedRole!,
                },
              });
            break;

          case "SUSPEND":
            if (
              existing.status !==
              StorefrontStaffStatus
                .ACTIVE
            ) {
              throw new GovernanceServiceError(
                "INVALID_STAFF_ACTION",
                "Only active staff access can be suspended.",
              );
            }

            await transaction
              .storefrontStaffMembership
              .update({
                where: {
                  id: existing.id,
                },
                data: {
                  status:
                    StorefrontStaffStatus
                      .SUSPENDED,
                  suspendedAt:
                    changedAt,
                  revokedAt: null,
                },
              });
            break;

          case "REACTIVATE":
            if (
              existing.status !==
              StorefrontStaffStatus
                .SUSPENDED
            ) {
              throw new GovernanceServiceError(
                "INVALID_STAFF_ACTION",
                "Only suspended staff access can be reactivated.",
              );
            }

            await transaction
              .storefrontStaffMembership
              .update({
                where: {
                  id: existing.id,
                },
                data: {
                  status:
                    StorefrontStaffStatus
                      .ACTIVE,
                  suspendedAt: null,
                  revokedAt: null,
                },
              });
            break;

          case "REVOKE":
            if (
              existing.status ===
              StorefrontStaffStatus
                .REVOKED
            ) {
              throw new GovernanceServiceError(
                "INVALID_STAFF_ACTION",
                "This staff access is already revoked.",
              );
            }

            await transaction
              .storefrontStaffMembership
              .update({
                where: {
                  id: existing.id,
                },
                data: {
                  status:
                    StorefrontStaffStatus
                      .REVOKED,
                  revokedAt: changedAt,
                },
              });
            break;

        }
      }

      const updated =
        await transaction
          .storefrontStaffMembership
          .findUniqueOrThrow({
            where: {
              userId_storefrontId: {
                userId: target.id,
                storefrontId:
                  manager.storefrontId,
              },
            },
            select: {
              id: true,
              role: true,
              status: true,
              grantedAt: true,
              user: {
                select: {
                  email: true,
                  customer: {
                    select: {
                      firstName: true,
                      lastName: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          });

      const toValue =
        `${updated.role}:${updated.status}`;

      await transaction
        .governanceAuditEvent.create({
          data: {
            storefrontId:
              manager.storefrontId,
            actorUserId:
              manager.userId,
            actorKind:
              GovernanceActorKind
                .STORE_MANAGER,
            actorEmail:
              manager.email,
            action:
              staffAuditAction(
                input.action,
              ),
            targetUserId: target.id,
            targetEmail:
              target.email,
            fromValue,
            toValue,
            note,
          },
        });

      return staffView(updated);
    },
  );
}

function managerAuditAction(
  action: ManagerStatusAction,
): GovernanceAction {
  switch (action) {
    case "SUSPEND":
      return GovernanceAction
        .MANAGER_SUSPENDED;
    case "REACTIVATE":
      return GovernanceAction
        .MANAGER_REACTIVATED;
    case "REVOKE":
      return GovernanceAction
        .MANAGER_REVOKED;
  }
}

export async function manageManagerStatus(
  input: {
    administratorUserId: string;
    membershipId: string;
    action: ManagerStatusAction;
    note?:
      | string
      | null;
  },
): Promise<AdminManagerView> {
  const membershipId =
    normalizeIdentifier(
      input.membershipId,
      "Manager membership",
    );
  const note = normalizeNote(
    input.note,
  );

  return runSerializable(
    async (transaction) => {
      const administrator =
        await resolvePlatformContext(
          transaction,
          input.administratorUserId,
        );

      const locked =
        await transaction.$queryRaw<
          Array<{
            id: string;
          }>
        >(Prisma.sql`
          SELECT id
          FROM storefront_staff_memberships
          WHERE id = ${membershipId}
          FOR UPDATE
        `);

      if (locked.length !== 1) {
        throw new GovernanceServiceError(
          "STAFF_TARGET_NOT_FOUND",
          "The manager membership was not found.",
        );
      }

      const membership =
        await transaction
          .storefrontStaffMembership
          .findUniqueOrThrow({
            where: {
              id: membershipId,
            },
            select: {
              id: true,
              userId: true,
              storefrontId: true,
              role: true,
              status: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          });

      if (
        membership.role !==
        StorefrontStaffRole.MANAGER
      ) {
        throw new GovernanceServiceError(
          "STAFF_TARGET_PROTECTED",
          "Only manager access can be changed from the administrator portal.",
        );
      }

      const changedAt = new Date();

      switch (input.action) {
        case "SUSPEND":
          if (
            membership.status !==
            StorefrontStaffStatus
              .ACTIVE
          ) {
            throw new GovernanceServiceError(
              "INVALID_MANAGER_ACTION",
              "Only an active manager can be suspended.",
            );
          }

          await transaction
            .storefrontStaffMembership
            .update({
              where: {
                id: membership.id,
              },
              data: {
                status:
                  StorefrontStaffStatus
                    .SUSPENDED,
                suspendedAt:
                  changedAt,
                revokedAt: null,
              },
            });
          break;

        case "REACTIVATE":
          if (
            membership.status !==
            StorefrontStaffStatus
              .SUSPENDED
          ) {
            throw new GovernanceServiceError(
              "INVALID_MANAGER_ACTION",
              "Only a suspended manager can be reactivated.",
            );
          }

          await transaction
            .storefrontStaffMembership
            .update({
              where: {
                id: membership.id,
              },
              data: {
                status:
                  StorefrontStaffStatus
                    .ACTIVE,
                suspendedAt: null,
                revokedAt: null,
              },
            });
          break;

        case "REVOKE":
          if (
            membership.status ===
            StorefrontStaffStatus
              .REVOKED
          ) {
            throw new GovernanceServiceError(
              "INVALID_MANAGER_ACTION",
              "This manager access is already revoked.",
            );
          }

          await transaction
            .storefrontStaffMembership
            .update({
              where: {
                id: membership.id,
              },
              data: {
                status:
                  StorefrontStaffStatus
                    .REVOKED,
                revokedAt: changedAt,
              },
            });
          break;
      }

      await transaction
        .governanceAuditEvent.create({
          data: {
            storefrontId:
              membership.storefrontId,
            actorUserId:
              administrator.userId,
            actorKind:
              GovernanceActorKind
                .PLATFORM_ADMINISTRATOR,
            actorEmail:
              administrator.email,
            action:
              managerAuditAction(
                input.action,
              ),
            targetUserId:
              membership.userId,
            targetEmail:
              membership.user.email,
            fromValue:
              membership.status,
            toValue:
              input.action ===
              "SUSPEND"
                ? StorefrontStaffStatus
                    .SUSPENDED
                : input.action ===
                    "REACTIVATE"
                  ? StorefrontStaffStatus
                      .ACTIVE
                  : StorefrontStaffStatus
                      .REVOKED,
            note,
          },
        });

      const updated =
        await transaction
          .storefrontStaffMembership
          .findUniqueOrThrow({
            where: {
              id: membership.id,
            },
            select: {
              id: true,
              status: true,
              grantedAt: true,
              storefront: {
                select: {
                  code: true,
                  name: true,
                },
              },
              user: {
                select: {
                  email: true,
                  customer: {
                    select: {
                      firstName: true,
                      lastName: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          });

      return adminManagerView(
        updated,
      );
    },
  );
}
