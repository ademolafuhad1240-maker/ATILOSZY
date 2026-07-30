import type {
  ManagerApplicationStatus,
  PlatformAdministratorRole,
  StorefrontStaffRole,
  StorefrontStaffStatus,
} from "@/generated/prisma/client";

export type ManagerApplicationDecision =
  | "APPROVE"
  | "REJECT";

export type StorefrontStaffAction =
  | "GRANT"
  | "CHANGE_ROLE"
  | "SUSPEND"
  | "REACTIVATE"
  | "REVOKE";

export type ManagerStatusAction =
  | "SUSPEND"
  | "REACTIVATE"
  | "REVOKE";

export interface ManagerApplicationView {
  id: string;
  status: ManagerApplicationStatus;
  statement: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface StaffMembershipView {
  id: string;
  email: string;
  name: string;
  role: StorefrontStaffRole;
  status: StorefrontStaffStatus;
  grantedAt: string;
}

export interface ManagerPortalView {
  account: {
    email: string;
    name: string;
  };
  storefront: {
    code: string;
    name: string;
  };
  membership: {
    role: StorefrontStaffRole;
    status: StorefrontStaffStatus;
  } | null;
  latestApplication:
    ManagerApplicationView | null;
  staff: StaffMembershipView[];
}

export interface AdminApplicationView
  extends ManagerApplicationView {
  storefront: {
    code: string;
    name: string;
  };
  applicant: {
    email: string;
    phone: string;
    name: string;
  };
}

export interface AdminManagerView {
  membershipId: string;
  storefront: {
    code: string;
    name: string;
  };
  manager: {
    email: string;
    name: string;
  };
  status: StorefrontStaffStatus;
  grantedAt: string;
}

export interface AdminGovernanceView {
  administrator: {
    role: PlatformAdministratorRole;
    email: string;
  };
  applications:
    AdminApplicationView[];
  managers: AdminManagerView[];
}
