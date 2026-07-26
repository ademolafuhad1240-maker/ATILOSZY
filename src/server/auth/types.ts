export interface RegisterCustomerInput {
  storefrontCode: string;
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  marketingOptIn?: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  tokenSecret: string;
}

export interface RegistrationResult {
  user: {
    id: string;
    storefrontId: string;
    status: string;
  };
  emailVerificationToken: string;
  phoneChallengeId: string;
  phoneVerificationCode: string;
}

export interface VerificationResult {
  userId: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: string;
}

export interface LoginCustomerInput {
  storefrontCode: string;
  email: string;
  password: string;
  tokenSecret: string;
  ipAddress?: string;
  userAgent?: string;
  sessionTtlMinutes?: number;
}

export interface LoginResult {
  sessionToken: string;
  session: {
    id: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    storefrontId: string;
    email: string;
    status: string;
  };
}

export interface ValidatedSession {
  sessionId: string;
  userId: string;
  storefrontId: string;
  storefrontCode: string;
  email: string;
  expiresAt: Date;
}
