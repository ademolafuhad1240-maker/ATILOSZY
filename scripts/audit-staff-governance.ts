import {
  readFileSync,
} from "node:fs";

function read(
  path: string,
): string {
  return readFileSync(
    path,
    "utf8",
  );
}

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function includesAll(
  source: string,
  fragments: string[],
): boolean {
  return fragments.every(
    (fragment) =>
      source.includes(fragment),
  );
}

function main(): void {
  console.log(
    "=== SORVYRA STAFF GOVERNANCE AUDIT ===",
  );

  const schema = read(
    "prisma/schema.prisma",
  );
  const migration = read(
    "prisma/migrations/20260730200000_staff_governance/migration.sql",
  );
  const service = read(
    "src/server/governance/service.ts",
  );
  const validation = read(
    "src/server/governance/validation.ts",
  );
  const applicationsRoute = read(
    "src/app/api/governance/applications/route.ts",
  );
  const reviewRoute = read(
    "src/app/api/governance/admin/applications/[applicationId]/review/route.ts",
  );
  const adminRoute = read(
    "src/app/api/governance/admin/route.ts",
  );
  const adminLoginRoute = read(
    "src/app/api/governance/admin/login/route.ts",
  );
  const adminLogoutRoute = read(
    "src/app/api/governance/admin/logout/route.ts",
  );
  const staffRoute = read(
    "src/app/api/governance/staff/route.ts",
  );
  const managerPortal = read(
    "src/components/governance/manager-portal.tsx",
  );
  const adminPortal = read(
    "src/components/governance/admin-portal.tsx",
  );
  const portalLogin = read(
    "src/components/governance/portal-login.tsx",
  );
  const authSession = read(
    "src/server/auth/session.ts",
  );
  const authHttp = read(
    "src/server/auth/http.ts",
  );
  const provision = read(
    "scripts/provision-platform-administrator.ts",
  );
  const envExample = read(
    ".env.example",
  );

  assertCondition(
    includesAll(schema, [
      "model PlatformAdministrator",
      "model ManagerApplication",
      "model GovernanceAuditEvent",
      "PLATFORM_ADMINISTRATOR",
      "STORE_MANAGER",
    ]) &&
      includesAll(migration, [
        "manager_applications_one_pending_per_user_storefront",
        "manager_applications_state_check",
        "governance_audit_events_shape_check",
        "ON DELETE RESTRICT",
      ]),
    "Governance persistence is incomplete or not fail-closed.",
  );
  console.log(
    "PASS: Platform administrators, manager applications and immutable governance events are persisted safely.",
  );

  assertCondition(
    includesAll(service, [
      "APPLICATION_SELF_REVIEW_FORBIDDEN",
      "PlatformAdministratorStatus",
      "StorefrontStaffRole.MANAGER",
      "Managers cannot change their own access.",
      "Serializable",
      "FOR UPDATE",
    ]) &&
      validation.includes(
        "Managers may grant only fulfilment or view-only access.",
      ),
    "Governance services do not enforce the required privilege and concurrency boundaries.",
  );
  console.log(
    "PASS: Approval, manager status and delegated staff actions enforce role boundaries and serializable transitions.",
  );

  const legacyProvisioning =
    readFileSync(
      "scripts/provision-storefront-staff.ts",
      "utf8",
    );

  assertCondition(
    /StorefrontStaffRole\s*\.FULFILMENT/u.test(
      legacyProvisioning,
    ) &&
      /StorefrontStaffRole\s*\.VIEWER/u.test(
        legacyProvisioning,
      ) &&
      legacyProvisioning.includes(
        "Manager access requires an approved manager application.",
      ) &&
      !legacyProvisioning.includes(
        "Object.values(\n      StorefrontStaffRole",
      ),
    "The protected legacy provisioning command can bypass manager approval.",
  );
  console.log(
    "PASS: Legacy provisioning cannot bypass the owner-approved manager application workflow.",
  );

  assertCondition(
    [
      applicationsRoute,
      staffRoute,
    ].every((source) =>
      includesAll(source, [
        "assertTrustedOrigin",
        "readGovernanceSession",
        "assertOnlyFields",
      ]),
    ) &&
      includesAll(reviewRoute, [
        "assertTrustedOrigin",
        "readPlatformGovernanceSession",
        "assertOnlyFields",
      ]),
    "Mutating governance APIs are missing the correct scoped session, origin or allowlist protection.",
  );
  console.log(
    "PASS: Governance APIs require the correct platform or storefront session, trusted origin and minimal server-controlled payloads.",
  );

  assertCondition(
    includesAll(authSession, [
      "loginPlatformAdministrator",
      "validatePlatformSession",
      "platformAdministrator",
      "candidates.length !== 1",
      "consumePasswordCost",
    ]) &&
      includesAll(authHttp, [
        "sorvyra_platform_session",
        "httpOnly: true",
        'sameSite: "lax"',
      ]) &&
      includesAll(adminLoginRoute, [
        "loginPlatformAdministrator",
        "setPlatformSessionCookie",
        "assertTrustedOrigin",
        'assertOnlyFields(body, [\n      "email",\n      "password",',
      ]) &&
      !adminLoginRoute.includes(
        "storefrontCode",
      ) &&
      includesAll(adminLogoutRoute, [
        "revokeSessionToken",
        "clearPlatformSessionCookie",
      ]) &&
      includesAll(adminRoute, [
        "readPlatformGovernanceSession",
        "getAdminGovernanceView",
      ]),
    "SORVYRA administrator authentication is not a fail-closed platform login.",
  );
  console.log(
    "PASS: SORVYRA administrator login resolves a global platform identity without browser-supplied storefront context.",
  );

  assertCondition(
    includesAll(managerPortal, [
      "/api/governance/applications",
      "/api/governance/staff",
      "Managers cannot grant",
      "data-manager-application-form",
    ]) &&
      includesAll(adminPortal, [
        "data-admin-applications",
        "data-admin-managers",
        "APPROVE",
        "REJECT",
        "SUSPEND",
        "REVOKE",
        "/api/governance/admin/logout",
      ]) &&
      !adminPortal.includes(
        "storefrontCode",
      ) &&
      includesAll(portalLogin, [
        "/api/governance/admin/login",
        "One SORVYRA identity",
        "Storefront managed",
      ]),
    "The manager or owner portal is missing required governance controls.",
  );
  console.log(
    "PASS: Central manager and SORVYRA owner portals expose the protected application and staff workflows.",
  );

  assertCondition(
    includesAll(provision, [
      "PLATFORM_ADMIN_PROVISIONING_ENABLED",
      '!==\n    "true"',
      'requiredArgument(\n      "confirm",',
      "UserStatus.ACTIVE",
      "emailVerifiedAt",
    ]) &&
      envExample.includes(
        "PLATFORM_ADMIN_PROVISIONING_ENABLED=false",
      ),
    "Platform administrator provisioning is not disabled by default.",
  );
  console.log(
    "PASS: Platform administrator provisioning is one-off, email-verified-account-only and disabled by default.",
  );

  console.log(
    "PASS: SORVYRA staff governance audit completed without database writes.",
  );
}

main();
