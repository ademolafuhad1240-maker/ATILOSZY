export interface GenericRecoveryResult {
  accepted: true;
}

export interface ResetPasswordResult {
  userId: string;
  storefrontId: string;
  sessionsRevoked: number;
}

export interface RecoveryClockOptions {
  now?: Date;
}

export interface RequestPasswordResetInput {
  storefrontCode: string;
  email: string;
  tokenSecret: string;
}

export interface ResetCustomerPasswordInput {
  storefrontCode: string;
  token: string;
  newPassword: string;
  tokenSecret: string;
}

export interface ResendRegistrationVerificationInput {
  storefrontCode: string;
  email: string;
  tokenSecret: string;
}
