import {
  randomBytes,
  randomInt,
} from "node:crypto";

import {
  PlatformAdministratorRole,
  PlatformAdministratorStatus,
  StorefrontStaffRole,
  StorefrontStaffStatus,
} from "../src/generated/prisma/client";
import {
  prisma,
} from "../src/lib/prisma";
import {
  registerCustomer,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";
import {
  getAdminGovernanceView,
  getManagerPortal,
  GovernanceServiceError,
  manageManagerStatus,
  manageStorefrontStaff,
  reviewManagerApplication,
  submitManagerApplication,
} from "../src/server/governance";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectGovernanceError(
  label: string,
  expectedCode:
    GovernanceServiceError["code"],
  operation: () => Promise<unknown>,
): Promise<void> {
  let discovered:
    | GovernanceServiceError
    | null = null;

  try {
    await operation();
  } catch (error) {
    if (
      error instanceof
      GovernanceServiceError
    ) {
      discovered = error;
    } else {
      throw error;
    }
  }

  assertCondition(
    discovered?.code ===
      expectedCode,
    `${label} did not return ${expectedCode}.`,
  );

  console.log(
    `PASS: ${label} returned ${expectedCode}.`,
  );
}

async function activateCustomer(
  input: {
    storefrontCode: string;
    email: string;
    phone: string;
    passwordToken: string;
    tokenSecret: string;
    displayName: string;
  },
) {
  const registration =
    await registerCustomer({
      storefrontCode:
        input.storefrontCode,
      email: input.email,
      phone: input.phone,
      password:
        `Governance-${input.passwordToken}-Password`,
      firstName: "Governance",
      lastName: "Audit",
      displayName:
        input.displayName,
      marketingOptIn: false,
      termsAccepted: true,
      privacyAccepted: true,
      tokenSecret:
        input.tokenSecret,
    });

  await verifyCustomerEmail({
    storefrontCode:
      input.storefrontCode,
    token:
      registration
        .emailVerificationToken,
    tokenSecret:
      input.tokenSecret,
  });

  await verifyCustomerPhone({
    storefrontCode:
      input.storefrontCode,
    challengeId:
      registration
        .phoneChallengeId,
    code:
      registration
        .phoneVerificationCode,
    tokenSecret:
      input.tokenSecret,
  });

  return registration.user;
}

async function main(): Promise<void> {
  console.log(
    "=== SORVYRA STAFF GOVERNANCE SERVICE AUDIT ===",
  );

  const tokenSecret =
    process.env.AUTH_TOKEN_SECRET;

  assertCondition(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const token =
    randomBytes(8)
      .toString("hex")
      .toUpperCase();
  const lowerToken =
    token.toLowerCase();
  const userIds: string[] = [];

  try {
    const owner =
      await activateCustomer({
        storefrontCode: "ATI",
        email:
          `governance-owner-${lowerToken}@example.test`,
        phone:
          `+23470${randomInt(
            10_000_000,
            99_999_999,
          )}`,
        passwordToken: token,
        tokenSecret,
        displayName:
          "Governance Owner Audit",
      });
    const applicant =
      await activateCustomer({
        storefrontCode: "ATI",
        email:
          `governance-applicant-${lowerToken}@example.test`,
        phone:
          `+23471${randomInt(
            10_000_000,
            99_999_999,
          )}`,
        passwordToken: token,
        tokenSecret,
        displayName:
          "Governance Applicant Audit",
      });
    const staff =
      await activateCustomer({
        storefrontCode: "ATI",
        email:
          `governance-staff-${lowerToken}@example.test`,
        phone:
          `+23472${randomInt(
            10_000_000,
            99_999_999,
          )}`,
        passwordToken: token,
        tokenSecret,
        displayName:
          "Governance Staff Audit",
      });
    const crossStoreStaff =
      await activateCustomer({
        storefrontCode: "ZBF",
        email:
          `governance-cross-${lowerToken}@example.test`,
        phone:
          `+23473${randomInt(
            10_000_000,
            99_999_999,
          )}`,
        passwordToken: token,
        tokenSecret,
        displayName:
          "Governance Cross Store Audit",
      });

    userIds.push(
      owner.id,
      applicant.id,
      staff.id,
      crossStoreStaff.id,
    );

    await prisma
      .platformAdministrator
      .createMany({
        data: [
          {
            userId: owner.id,
            role:
              PlatformAdministratorRole
                .OWNER,
            status:
              PlatformAdministratorStatus
                .ACTIVE,
          },
          {
            userId: applicant.id,
            role:
              PlatformAdministratorRole
                .ADMIN,
            status:
              PlatformAdministratorStatus
                .ACTIVE,
          },
        ],
      });

    const application =
      await submitManagerApplication({
        storefrontCode: "ATI",
        userId: applicant.id,
        statement:
          "I operate the temporary ATILOSZY governance audit and can manage orders, inventory coordination and fulfilment staff safely.",
      });

    assertCondition(
      application.status ===
        "PENDING",
      "Manager application was not created as pending.",
    );

    await expectGovernanceError(
      "duplicate pending application",
      "APPLICATION_ALREADY_PENDING",
      () =>
        submitManagerApplication({
          storefrontCode: "ATI",
          userId: applicant.id,
          statement:
            "This duplicate governance application must be rejected before any additional record is created for the same storefront.",
        }),
    );

    await expectGovernanceError(
      "administrator self-review",
      "APPLICATION_SELF_REVIEW_FORBIDDEN",
      () =>
        reviewManagerApplication({
          administratorUserId:
            applicant.id,
          applicationId:
            application.id,
          decision: "APPROVE",
        }),
    );

    const beforeApproval =
      await getAdminGovernanceView({
        userId: owner.id,
      });

    assertCondition(
      beforeApproval.applications
        .some(
          (candidate) =>
            candidate.id ===
              application.id &&
            candidate.storefront
              .code === "ATI",
        ),
      "The owner application queue did not include the pending storefront application.",
    );

    const approved =
      await reviewManagerApplication({
        administratorUserId:
          owner.id,
        applicationId:
          application.id,
        decision: "APPROVE",
        note:
          "Temporary governance audit approval.",
      });

    assertCondition(
      approved.status ===
        "APPROVED",
      "The manager application was not approved.",
    );

    await expectGovernanceError(
      "repeated application review",
      "APPLICATION_NOT_PENDING",
      () =>
        reviewManagerApplication({
          administratorUserId:
            owner.id,
          applicationId:
            application.id,
          decision: "REJECT",
        }),
    );

    const portal =
      await getManagerPortal({
        storefrontCode: "ATI",
        userId: applicant.id,
      });

    assertCondition(
      portal.membership?.role ===
        StorefrontStaffRole
          .MANAGER &&
        portal.membership.status ===
          StorefrontStaffStatus
            .ACTIVE,
      "Application approval did not grant active manager access.",
    );
    console.log(
      "PASS: SORVYRA approval grants manager access only after authenticated review.",
    );

    await expectGovernanceError(
      "cross-store staff grant",
      "STAFF_TARGET_NOT_FOUND",
      () =>
        manageStorefrontStaff({
          storefrontCode: "ATI",
          managerUserId:
            applicant.id,
          targetEmail:
            `governance-cross-${lowerToken}@example.test`,
          action: "GRANT",
          role: "FULFILMENT",
        }),
    );

    await expectGovernanceError(
      "delegated manager grant",
      "VALIDATION",
      () =>
        manageStorefrontStaff({
          storefrontCode: "ATI",
          managerUserId:
            applicant.id,
          targetEmail:
            `governance-staff-${lowerToken}@example.test`,
          action: "GRANT",
          role: "MANAGER",
        }),
    );

    const granted =
      await manageStorefrontStaff({
        storefrontCode: "ATI",
        managerUserId:
          applicant.id,
        targetEmail:
          `governance-staff-${lowerToken}@example.test`,
        action: "GRANT",
        role: "FULFILMENT",
        note:
          "Temporary audit staff.",
      });
    const roleChanged =
      await manageStorefrontStaff({
        storefrontCode: "ATI",
        managerUserId:
          applicant.id,
        targetEmail: granted.email,
        action: "CHANGE_ROLE",
        role: "VIEWER",
      });
    const suspendedStaff =
      await manageStorefrontStaff({
        storefrontCode: "ATI",
        managerUserId:
          applicant.id,
        targetEmail: granted.email,
        action: "SUSPEND",
      });
    const reactivatedStaff =
      await manageStorefrontStaff({
        storefrontCode: "ATI",
        managerUserId:
          applicant.id,
        targetEmail: granted.email,
        action: "REACTIVATE",
      });
    const revokedStaff =
      await manageStorefrontStaff({
        storefrontCode: "ATI",
        managerUserId:
          applicant.id,
        targetEmail: granted.email,
        action: "REVOKE",
      });

    assertCondition(
      granted.role ===
        StorefrontStaffRole
          .FULFILMENT &&
        roleChanged.role ===
          StorefrontStaffRole
            .VIEWER &&
        suspendedStaff.status ===
          StorefrontStaffStatus
            .SUSPENDED &&
        reactivatedStaff.status ===
          StorefrontStaffStatus
            .ACTIVE &&
        revokedStaff.status ===
          StorefrontStaffStatus
            .REVOKED,
      "Store manager staff lifecycle did not preserve delegated-role boundaries.",
    );
    console.log(
      "PASS: Managers can grant and control only fulfilment or view-only staff inside their storefront.",
    );

    const managerRecord =
      (
        await getAdminGovernanceView({
          userId: owner.id,
        })
      ).managers.find(
        (manager) =>
          manager.manager.email ===
          `governance-applicant-${lowerToken}@example.test`,
      );

    assertCondition(
      managerRecord,
      "The approved manager was missing from the owner directory.",
    );

    const suspendedManager =
      await manageManagerStatus({
        administratorUserId:
          owner.id,
        membershipId:
          managerRecord.membershipId,
        action: "SUSPEND",
      });

    await expectGovernanceError(
      "suspended manager staff action",
      "MANAGER_ACCESS_REQUIRED",
      () =>
        manageStorefrontStaff({
          storefrontCode: "ATI",
          managerUserId:
            applicant.id,
          targetEmail:
            `governance-staff-${lowerToken}@example.test`,
          action: "GRANT",
          role: "VIEWER",
        }),
    );

    const reactivatedManager =
      await manageManagerStatus({
        administratorUserId:
          owner.id,
        membershipId:
          managerRecord.membershipId,
        action: "REACTIVATE",
      });
    const revokedManager =
      await manageManagerStatus({
        administratorUserId:
          owner.id,
        membershipId:
          managerRecord.membershipId,
        action: "REVOKE",
      });

    assertCondition(
      suspendedManager.status ===
        StorefrontStaffStatus
          .SUSPENDED &&
        reactivatedManager.status ===
          StorefrontStaffStatus
            .ACTIVE &&
        revokedManager.status ===
          StorefrontStaffStatus
            .REVOKED,
      "SORVYRA owner manager lifecycle controls failed.",
    );

    const eventCount =
      await prisma
        .governanceAuditEvent
        .count({
          where: {
            OR: [
              {
                actorUserId: {
                  in: userIds,
                },
              },
              {
                targetUserId: {
                  in: userIds,
                },
              },
            ],
          },
        });

    assertCondition(
      eventCount === 10,
      `Expected 10 immutable governance events, found ${eventCount}.`,
    );
    console.log(
      "PASS: Application, manager and staff lifecycle decisions produced immutable audit events.",
    );
  } finally {
    if (userIds.length > 0) {
      await prisma
        .governanceAuditEvent
        .deleteMany({
          where: {
            OR: [
              {
                actorUserId: {
                  in: userIds,
                },
              },
              {
                targetUserId: {
                  in: userIds,
                },
              },
            ],
          },
        });
      await prisma
        .managerApplication
        .deleteMany({
          where: {
            applicantUserId: {
              in: userIds,
            },
          },
        });
      await prisma
        .platformAdministrator
        .deleteMany({
          where: {
            userId: {
              in: userIds,
            },
          },
        });
      await prisma
        .storefrontStaffMembership
        .deleteMany({
          where: {
            userId: {
              in: userIds,
            },
          },
        });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });
    }

    console.log(
      "PASS: Temporary staff governance audit records removed.",
    );
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
