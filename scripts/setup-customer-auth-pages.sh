#!/usr/bin/env bash

set -Eeuo pipefail

echo "=== VERIFY CLEAN CHECKPOINT ==="

EXPECTED_BRANCH="feat/commerce-foundation"
CURRENT_BRANCH="$(git branch --show-current)"

if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
  echo "Expected branch: $EXPECTED_BRANCH"
  echo "Current branch: $CURRENT_BRANCH"
  exit 1
fi

UNEXPECTED_CHANGES="$(
  git status --porcelain |
  grep -v '^?? scripts/setup-customer-auth-pages.sh$' ||
  true
)"

if [ -n "$UNEXPECTED_CHANGES" ]; then
  echo "Unexpected repository changes exist:"
  printf '%s\n' "$UNEXPECTED_CHANGES"
  exit 1
fi

echo "Branch: $CURRENT_BRANCH"
echo "Starting commit: $(git rev-parse --short HEAD)"
echo "PASS: No unexpected repository changes found."

echo
echo "=== VERIFY AUTHENTICATION ENVIRONMENT ==="

node --env-file=.env <<'NODE'
const secret = process.env.AUTH_TOKEN_SECRET;
const origin = process.env.APP_ORIGIN;

if (!secret || secret.length < 32) {
  throw new Error(
    "AUTH_TOKEN_SECRET must contain at least 32 characters.",
  );
}

if (!origin) {
  throw new Error(
    "APP_ORIGIN is missing.",
  );
}

console.log(
  "PASS: Authentication environment is available without printing secrets.",
);
NODE

echo
echo "=== CREATE AUTHENTICATION PAGE DIRECTORIES ==="

mkdir -p \
  src/components/auth \
  src/lib \
  src/server/auth

echo
echo "=== CREATE STOREFRONT AUTH CONFIGURATION ==="

cat > src/lib/storefront-auth.ts <<'TS'
export type StorefrontAuthCode =
  | "ATI"
  | "ZBF"
  | "DEN"
  | "ZCH";

export interface StorefrontAuthConfig {
  code: StorefrontAuthCode;
  name: string;
  shortName: string;
  countryName: string;
  currencyCode: "NGN" | "QAR";
  baseHref: string;
  accountHref: string;
  loginHref: string;
  registerHref: string;
  verifyHref: string;
  accent: string;
  accentStrong: string;
  surface: string;
  deep: string;
  description: string;
}

const storefronts = {
  ATI: {
    code: "ATI",
    name: "ATILOSZY Varieties Store",
    shortName: "ATILOSZY",
    countryName: "Nigeria",
    currencyCode: "NGN",
    baseHref: "/ng/atiloszy",
    accountHref: "/ng/atiloszy/account",
    loginHref: "/ng/atiloszy/account/login",
    registerHref:
      "/ng/atiloszy/account/register",
    verifyHref:
      "/ng/atiloszy/account/verify",
    accent: "#b8a16a",
    accentStrong: "#8c7138",
    surface: "#f5efe3",
    deep: "#0c1923",
    description:
      "Manage your ATILOSZY orders, pickup reservations and delivery updates.",
  },
  ZBF: {
    code: "ZBF",
    name: "ZEE Beauty & Fashion World",
    shortName: "ZEE Beauty",
    countryName: "Nigeria",
    currencyCode: "NGN",
    baseHref: "/ng/zee-beauty-fashion",
    accountHref:
      "/ng/zee-beauty-fashion/account",
    loginHref:
      "/ng/zee-beauty-fashion/account/login",
    registerHref:
      "/ng/zee-beauty-fashion/account/register",
    verifyHref:
      "/ng/zee-beauty-fashion/account/verify",
    accent: "#b04b72",
    accentStrong: "#7e294d",
    surface: "#faedf2",
    deep: "#28101a",
    description:
      "Manage your beauty, fashion and household purchases securely.",
  },
  DEN: {
    code: "DEN",
    name: "DENALD Solar | CCTV | Computer",
    shortName: "DENALD",
    countryName: "Nigeria",
    currencyCode: "NGN",
    baseHref: "/ng/denald",
    accountHref: "/ng/denald/account",
    loginHref: "/ng/denald/account/login",
    registerHref:
      "/ng/denald/account/register",
    verifyHref:
      "/ng/denald/account/verify",
    accent: "#15929c",
    accentStrong: "#08656d",
    surface: "#eaf6f6",
    deep: "#071c23",
    description:
      "Manage product purchases, technical requests and installation updates.",
  },
  ZCH: {
    code: "ZCH",
    name: "Zee COMFORT HUB",
    shortName: "COMFORT HUB",
    countryName: "Qatar",
    currencyCode: "QAR",
    baseHref: "/qa/zee-comfort-hub",
    accountHref:
      "/qa/zee-comfort-hub/account",
    loginHref:
      "/qa/zee-comfort-hub/account/login",
    registerHref:
      "/qa/zee-comfort-hub/account/register",
    verifyHref:
      "/qa/zee-comfort-hub/account/verify",
    accent: "#a23c60",
    accentStrong: "#74243f",
    surface: "#faebf0",
    deep: "#2a111b",
    description:
      "Manage your comfort-wear orders, pickup and Qatar-wide delivery.",
  },
} satisfies Record<
  StorefrontAuthCode,
  StorefrontAuthConfig
>;

export function getStorefrontAuthConfig(
  code: StorefrontAuthCode,
): StorefrontAuthConfig {
  return storefronts[code];
}

export function getAllStorefrontAuthConfigs(): StorefrontAuthConfig[] {
  return [
    storefronts.ATI,
    storefronts.ZBF,
    storefronts.DEN,
    storefronts.ZCH,
  ];
}
TS

echo
echo "=== CREATE ACCOUNT SUMMARY SERVICE ==="

cat > src/server/auth/account.ts <<'TS'
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
TS

echo
echo "=== CREATE PROTECTED PAGE SESSION HELPER ==="

cat > src/server/auth/page-session.ts <<'TS'
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type {
  ValidatedSession,
} from "./types";
import {
  AuthServiceError,
} from "./errors";
import {
  validateSession,
} from "./session";
import {
  getAuthTokenSecret,
  getSessionCookieName,
} from "./http";

export async function requireStorefrontSession(
  storefrontCode: string,
  loginHref: string,
): Promise<ValidatedSession> {
  const cookieStore = await cookies();

  const sessionToken = cookieStore.get(
    getSessionCookieName(
      storefrontCode,
    ),
  )?.value;

  if (!sessionToken) {
    redirect(loginHref);
  }

  try {
    return await validateSession({
      storefrontCode,
      sessionToken,
      tokenSecret:
        getAuthTokenSecret(),
    });
  } catch (error) {
    if (
      error instanceof AuthServiceError &&
      (
        error.code === "SESSION_INVALID" ||
        error.code ===
          "ACCOUNT_UNAVAILABLE"
      )
    ) {
      redirect(loginHref);
    }

    throw error;
  }
}
TS

echo
echo "=== CREATE AUTHENTICATION PAGE STYLES ==="

cat > src/components/auth/auth.module.css <<'CSS'
.shell {
  --auth-accent: #b8a16a;
  --auth-accent-strong: #8c7138;
  --auth-surface: #f5efe3;
  --auth-deep: #0c1923;

  min-height: 100vh;
  position: relative;
  overflow: hidden;
  color: #f8fafc;
  background:
    radial-gradient(
      circle at 12% 8%,
      color-mix(
        in srgb,
        var(--auth-accent) 24%,
        transparent
      ),
      transparent 34rem
    ),
    radial-gradient(
      circle at 90% 80%,
      color-mix(
        in srgb,
        var(--auth-accent) 15%,
        transparent
      ),
      transparent 32rem
    ),
    linear-gradient(
      145deg,
      var(--auth-deep),
      #09131b 58%,
      #050a0f
    );
}

.ambientOne,
.ambientTwo {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  filter: blur(4px);
  opacity: 0.7;
}

.ambientOne {
  width: 22rem;
  height: 22rem;
  top: -10rem;
  right: -7rem;
  border: 1px solid
    color-mix(
      in srgb,
      var(--auth-accent) 42%,
      transparent
    );
  box-shadow:
    inset 0 0 5rem
      color-mix(
        in srgb,
        var(--auth-accent) 12%,
        transparent
      );
}

.ambientTwo {
  width: 15rem;
  height: 15rem;
  left: -7rem;
  bottom: 5rem;
  background:
    color-mix(
      in srgb,
      var(--auth-accent) 8%,
      transparent
    );
}

.header {
  width: min(1180px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 1.25rem 0;
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid
    rgba(255, 255, 255, 0.09);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.brandMark {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.9rem;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: #081117;
  font-weight: 900;
  letter-spacing: 0.05em;
  background:
    linear-gradient(
      135deg,
      #ffffff,
      var(--auth-accent)
    );
  box-shadow:
    0 0.75rem 2.5rem
      color-mix(
        in srgb,
        var(--auth-accent) 24%,
        transparent
      );
}

.brandCopy {
  min-width: 0;
}

.eyebrow {
  display: block;
  margin-bottom: 0.12rem;
  color:
    color-mix(
      in srgb,
      var(--auth-accent) 76%,
      white
    );
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.brandName {
  display: block;
  color: #ffffff;
  font-size: 0.98rem;
  font-weight: 760;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.headerNav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.headerLink {
  padding: 0.66rem 0.92rem;
  border: 1px solid
    rgba(255, 255, 255, 0.11);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.79rem;
  font-weight: 700;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    background 180ms ease;
}

.headerLink:hover {
  transform: translateY(-1px);
  color: #ffffff;
  border-color:
    color-mix(
      in srgb,
      var(--auth-accent) 54%,
      transparent
    );
  background:
    rgba(255, 255, 255, 0.05);
}

.main {
  width: min(1180px, calc(100% - 2rem));
  margin: 0 auto;
  position: relative;
  z-index: 2;
  padding: clamp(2.6rem, 7vw, 6.5rem) 0 4rem;
}

.layout {
  display: grid;
  grid-template-columns:
    minmax(0, 0.88fr)
    minmax(20rem, 0.72fr);
  align-items: center;
  gap: clamp(2rem, 6vw, 6rem);
}

.intro {
  max-width: 42rem;
}

.kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 1.25rem;
  color:
    color-mix(
      in srgb,
      var(--auth-accent) 76%,
      white
    );
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.kicker::before {
  content: "";
  width: 1.65rem;
  height: 1px;
  background: var(--auth-accent);
}

.title {
  max-width: 12ch;
  margin: 0;
  color: #ffffff;
  font-size:
    clamp(2.5rem, 6vw, 5.4rem);
  line-height: 0.98;
  letter-spacing: -0.065em;
}

.description {
  max-width: 36rem;
  margin: 1.5rem 0 0;
  color: rgba(240, 246, 250, 0.68);
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  line-height: 1.75;
}

.trustRow {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1.7rem;
}

.trustItem {
  padding: 0.62rem 0.8rem;
  border: 1px solid
    rgba(255, 255, 255, 0.09);
  border-radius: 0.75rem;
  color: rgba(255, 255, 255, 0.68);
  background:
    rgba(255, 255, 255, 0.035);
  font-size: 0.72rem;
  font-weight: 700;
}

.panel {
  width: 100%;
  border: 1px solid
    rgba(255, 255, 255, 0.12);
  border-radius: 1.65rem;
  padding:
    clamp(1.25rem, 3vw, 2.15rem);
  background:
    linear-gradient(
      150deg,
      rgba(255, 255, 255, 0.11),
      rgba(255, 255, 255, 0.045)
    );
  box-shadow:
    0 2rem 7rem
      rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(24px);
}

.panelHeader {
  margin-bottom: 1.5rem;
}

.panelTitle {
  margin: 0;
  color: #ffffff;
  font-size: 1.65rem;
  letter-spacing: -0.035em;
}

.panelText {
  margin: 0.55rem 0 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.88rem;
  line-height: 1.6;
}

.form {
  display: grid;
  gap: 1rem;
}

.fieldGrid {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.field {
  display: grid;
  gap: 0.46rem;
}

.label {
  color: rgba(255, 255, 255, 0.76);
  font-size: 0.73rem;
  font-weight: 760;
}

.input {
  width: 100%;
  min-height: 3rem;
  border: 1px solid
    rgba(255, 255, 255, 0.12);
  border-radius: 0.82rem;
  padding: 0.8rem 0.9rem;
  color: #ffffff;
  background:
    rgba(4, 10, 15, 0.54);
  outline: none;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

.input::placeholder {
  color: rgba(255, 255, 255, 0.31);
}

.input:focus {
  border-color:
    color-mix(
      in srgb,
      var(--auth-accent) 72%,
      white
    );
  box-shadow:
    0 0 0 3px
      color-mix(
        in srgb,
        var(--auth-accent) 16%,
        transparent
      );
  background:
    rgba(4, 10, 15, 0.72);
}

.checkboxRow {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.76rem;
  line-height: 1.55;
}

.checkbox {
  margin-top: 0.18rem;
  accent-color: var(--auth-accent);
}

.primaryButton {
  min-height: 3.15rem;
  border: 0;
  border-radius: 0.9rem;
  padding: 0.85rem 1rem;
  cursor: pointer;
  color: #071116;
  background:
    linear-gradient(
      135deg,
      #ffffff,
      var(--auth-accent)
    );
  font-size: 0.83rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  box-shadow:
    0 1rem 2.5rem
      color-mix(
        in srgb,
        var(--auth-accent) 22%,
        transparent
      );
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.primaryButton:hover:not(:disabled) {
  transform: translateY(-2px);
}

.primaryButton:disabled {
  cursor: wait;
  opacity: 0.62;
}

.secondaryButton {
  min-height: 2.9rem;
  border: 1px solid
    rgba(255, 255, 255, 0.13);
  border-radius: 0.85rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  color: #ffffff;
  background:
    rgba(255, 255, 255, 0.05);
  font-size: 0.78rem;
  font-weight: 800;
}

.formFooter {
  margin: 1.15rem 0 0;
  color: rgba(255, 255, 255, 0.53);
  font-size: 0.78rem;
  line-height: 1.6;
  text-align: center;
}

.inlineLink {
  color:
    color-mix(
      in srgb,
      var(--auth-accent) 76%,
      white
    );
  font-weight: 800;
}

.notice,
.errorNotice,
.successNotice {
  border-radius: 0.85rem;
  padding: 0.85rem 0.95rem;
  font-size: 0.78rem;
  line-height: 1.55;
}

.notice {
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid
    rgba(255, 255, 255, 0.11);
  background:
    rgba(255, 255, 255, 0.045);
}

.errorNotice {
  color: #ffd8df;
  border: 1px solid
    rgba(255, 103, 135, 0.26);
  background:
    rgba(128, 18, 48, 0.23);
}

.successNotice {
  color: #d9ffec;
  border: 1px solid
    rgba(89, 224, 157, 0.23);
  background:
    rgba(17, 111, 74, 0.23);
}

.verifyStack {
  display: grid;
  gap: 1rem;
}

.verifyCard {
  border: 1px solid
    rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
  padding: 1rem;
  background:
    rgba(4, 10, 15, 0.26);
}

.verifyTitle {
  margin: 0 0 0.35rem;
  color: #ffffff;
  font-size: 0.95rem;
}

.verifyText {
  margin: 0 0 0.85rem;
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.74rem;
  line-height: 1.55;
}

.accountPanel {
  width: 100%;
}

.accountTop {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.4rem;
}

.accountIdentity {
  min-width: 0;
}

.accountName {
  margin: 0;
  color: #ffffff;
  font-size: 1.55rem;
  letter-spacing: -0.035em;
}

.accountEmail {
  margin: 0.4rem 0 0;
  color: rgba(255, 255, 255, 0.58);
  overflow-wrap: anywhere;
}

.statusPill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.85rem;
  padding: 0.48rem 0.67rem;
  border-radius: 999px;
  color: #d9ffec;
  background:
    rgba(39, 166, 106, 0.18);
  border: 1px solid
    rgba(90, 220, 159, 0.22);
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.statusPill::before {
  content: "";
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: #72e3ad;
  box-shadow:
    0 0 0.8rem
      rgba(114, 227, 173, 0.65);
}

.accountGrid {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.accountCard {
  min-width: 0;
  border: 1px solid
    rgba(255, 255, 255, 0.095);
  border-radius: 1rem;
  padding: 1rem;
  background:
    rgba(4, 10, 15, 0.25);
}

.accountCardLabel {
  margin: 0;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.64rem;
  font-weight: 820;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.accountCardValue {
  margin: 0.45rem 0 0;
  color: #ffffff;
  font-size: 0.84rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.accountActions {
  display: flex;
  gap: 0.7rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.portalIntro {
  max-width: 46rem;
  margin: 0 auto 2rem;
  text-align: center;
}

.portalTitle {
  margin: 0;
  color: #ffffff;
  font-size:
    clamp(2.4rem, 6vw, 4.8rem);
  line-height: 1;
  letter-spacing: -0.06em;
}

.portalText {
  margin: 1rem auto 0;
  max-width: 38rem;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.7;
}

.portalGrid {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.portalCard {
  position: relative;
  overflow: hidden;
  min-height: 13rem;
  border: 1px solid
    rgba(255, 255, 255, 0.11);
  border-radius: 1.3rem;
  padding: 1.35rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.105),
      rgba(255, 255, 255, 0.035)
    );
  transition:
    transform 190ms ease,
    border-color 190ms ease;
}

.portalCard:hover {
  transform: translateY(-3px);
  border-color:
    color-mix(
      in srgb,
      var(--card-accent) 50%,
      transparent
    );
}

.portalCard::before {
  content: "";
  position: absolute;
  width: 11rem;
  height: 11rem;
  right: -4rem;
  top: -5rem;
  border-radius: 999px;
  background:
    color-mix(
      in srgb,
      var(--card-accent) 22%,
      transparent
    );
  filter: blur(2px);
}

.portalCountry {
  position: relative;
  color:
    color-mix(
      in srgb,
      var(--card-accent) 70%,
      white
    );
  font-size: 0.65rem;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.portalName {
  position: relative;
  margin: 0.55rem 0 0;
  color: #ffffff;
  font-size: 1.2rem;
  letter-spacing: -0.03em;
}

.portalAction {
  position: relative;
  margin-top: 0.9rem;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.75rem;
  font-weight: 740;
}

@media (max-width: 840px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .intro {
    text-align: center;
    margin: 0 auto;
  }

  .title,
  .description {
    margin-left: auto;
    margin-right: auto;
  }

  .kicker,
  .trustRow {
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .header {
    align-items: flex-start;
  }

  .headerNav {
    gap: 0.35rem;
  }

  .headerLink {
    padding: 0.55rem 0.68rem;
    font-size: 0.68rem;
  }

  .brandName {
    max-width: 11rem;
  }

  .main {
    padding-top: 2.4rem;
  }

  .fieldGrid,
  .accountGrid,
  .portalGrid {
    grid-template-columns: 1fr;
  }

  .accountTop {
    display: grid;
  }

  .panel {
    border-radius: 1.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .headerLink,
  .primaryButton,
  .portalCard {
    transition: none;
  }
}
CSS

echo
echo "=== CREATE AUTHENTICATION SHELL ==="

cat > src/components/auth/auth-shell.tsx <<'TS'
import type {
  CSSProperties,
  ReactNode,
} from "react";
import Link from "next/link";

import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";

import styles from "./auth.module.css";

interface AuthShellProps {
  storefront: StorefrontAuthConfig;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({
  storefront,
  title,
  description,
  children,
}: AuthShellProps) {
  const themeStyle = {
    "--auth-accent":
      storefront.accent,
    "--auth-accent-strong":
      storefront.accentStrong,
    "--auth-surface":
      storefront.surface,
    "--auth-deep":
      storefront.deep,
  } as CSSProperties;

  return (
    <div
      className={styles.shell}
      style={themeStyle}
      data-auth-storefront={
        storefront.code
      }
    >
      <div
        className={styles.ambientOne}
        aria-hidden="true"
      />
      <div
        className={styles.ambientTwo}
        aria-hidden="true"
      />

      <header className={styles.header}>
        <Link
          href={storefront.baseHref}
          className={styles.brand}
          aria-label={`Return to ${storefront.name}`}
        >
          <span
            className={styles.brandMark}
            aria-hidden="true"
          >
            {storefront.code.slice(0, 1)}
          </span>

          <span
            className={styles.brandCopy}
          >
            <span
              className={styles.eyebrow}
            >
              SORVYRA STORE ·{" "}
              {storefront.countryName}
            </span>

            <span
              className={styles.brandName}
            >
              {storefront.name}
            </span>
          </span>
        </Link>

        <nav
          className={styles.headerNav}
          aria-label="Account navigation"
        >
          <Link
            href={storefront.baseHref}
            className={styles.headerLink}
          >
            Store
          </Link>

          <Link
            href={storefront.loginHref}
            className={styles.headerLink}
          >
            Sign in
          </Link>

          <Link
            href={storefront.registerHref}
            className={styles.headerLink}
          >
            Register
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.layout}>
          <section className={styles.intro}>
            <span className={styles.kicker}>
              Private storefront account
            </span>

            <h1 className={styles.title}>
              {title}
            </h1>

            <p
              className={styles.description}
            >
              {description}
            </p>

            <div className={styles.trustRow}>
              <span
                className={styles.trustItem}
              >
                Store-isolated account
              </span>

              <span
                className={styles.trustItem}
              >
                Email + phone verification
              </span>

              <span
                className={styles.trustItem}
              >
                Protected session
              </span>
            </div>
          </section>

          <section className={styles.panel}>
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
TS

echo
echo "=== CREATE LOGIN AND REGISTRATION FORMS ==="

cat > src/components/auth/auth-forms.tsx <<'TS'
"use client";

import {
  type FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";

import styles from "./auth.module.css";

interface ApiPayload {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
}

interface FormNotice {
  kind: "error" | "success";
  message: string;
}

async function readApiPayload(
  response: Response,
): Promise<ApiPayload> {
  try {
    return await response.json() as ApiPayload;
  } catch {
    return {};
  }
}

function errorMessage(
  payload: ApiPayload,
  fallback: string,
): string {
  return (
    payload.error?.message ??
    fallback
  );
}

export function LoginForm({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  const router = useRouter();

  const [
    notice,
    setNotice,
  ] = useState<FormNotice | null>(
    null,
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const form =
      event.currentTarget;

    const formData =
      new FormData(form);

    setNotice(null);
    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode:
              storefront.code,
            email:
              formData.get("email"),
            password:
              formData.get("password"),
          }),
        },
      );

      const payload =
        await readApiPayload(response);

      if (!response.ok) {
        throw new Error(
          errorMessage(
            payload,
            "Sign in could not be completed.",
          ),
        );
      }

      setNotice({
        kind: "success",
        message:
          "Sign in successful. Opening your account…",
      });

      router.replace(
        storefront.accountHref,
      );

      router.refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Sign in could not be completed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Welcome back
        </h2>

        <p className={styles.panelText}>
          Use the email and password
          registered specifically with{" "}
          {storefront.shortName}.
        </p>
      </div>

      <form
        className={styles.form}
        onSubmit={handleSubmit}
        data-auth-form="login"
      >
        <label className={styles.field}>
          <span className={styles.label}>
            Email address
          </span>

          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            required
            placeholder="you@example.com"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Password
          </span>

          <input
            className={styles.input}
            type="password"
            name="password"
            autoComplete="current-password"
            maxLength={128}
            required
            placeholder="Your password"
          />
        </label>

        {notice ? (
          <div
            className={
              notice.kind === "error"
                ? styles.errorNotice
                : styles.successNotice
            }
            role={
              notice.kind === "error"
                ? "alert"
                : "status"
            }
            aria-live="polite"
          >
            {notice.message}
          </div>
        ) : null}

        <button
          className={styles.primaryButton}
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Signing in…"
            : `Sign in to ${storefront.shortName}`}
        </button>
      </form>

      <p className={styles.formFooter}>
        New to this storefront?{" "}
        <Link
          href={storefront.registerHref}
          className={styles.inlineLink}
        >
          Create an account
        </Link>
        .
      </p>
    </>
  );
}

export function RegistrationForm({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  const [
    notice,
    setNotice,
  ] = useState<FormNotice | null>(
    null,
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const form =
      event.currentTarget;

    const formData =
      new FormData(form);

    setNotice(null);
    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode:
              storefront.code,
            firstName:
              formData.get(
                "firstName",
              ),
            lastName:
              formData.get(
                "lastName",
              ),
            displayName:
              formData.get(
                "displayName",
              ) || undefined,
            email:
              formData.get("email"),
            phone:
              formData.get("phone"),
            password:
              formData.get(
                "password",
              ),
            marketingOptIn:
              formData.get(
                "marketingOptIn",
              ) === "on",
            termsAccepted:
              formData.get(
                "termsAccepted",
              ) === "on",
            privacyAccepted:
              formData.get(
                "privacyAccepted",
              ) === "on",
          }),
        },
      );

      const payload =
        await readApiPayload(response);

      if (!response.ok) {
        throw new Error(
          errorMessage(
            payload,
            "Registration could not be completed.",
          ),
        );
      }

      form.reset();

      setNotice({
        kind: "success",
        message:
          "Account created. Complete both verification steps when your email and phone messages arrive.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Registration could not be completed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Create your account
        </h2>

        <p className={styles.panelText}>
          This account belongs only to{" "}
          {storefront.name}. Accounts,
          carts and orders remain separate
          between SORVYRA storefronts.
        </p>
      </div>

      <div className={styles.notice}>
        Registration remains unavailable
        until verified email and SMS
        delivery providers are connected.
        This form is ready for activation
        afterward.
      </div>

      <form
        className={styles.form}
        onSubmit={handleSubmit}
        data-auth-form="register"
      >
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.label}>
              First name
            </span>

            <input
              className={styles.input}
              type="text"
              name="firstName"
              autoComplete="given-name"
              maxLength={100}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Last name
            </span>

            <input
              className={styles.input}
              type="text"
              name="lastName"
              autoComplete="family-name"
              maxLength={100}
              required
            />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>
            Display name{" "}
            <span aria-hidden="true">
              · optional
            </span>
          </span>

          <input
            className={styles.input}
            type="text"
            name="displayName"
            autoComplete="nickname"
            maxLength={100}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Email address
          </span>

          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            required
            placeholder="you@example.com"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Phone number
          </span>

          <input
            className={styles.input}
            type="tel"
            name="phone"
            autoComplete="tel"
            maxLength={32}
            required
            placeholder="+234… or +974…"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Password
          </span>

          <input
            className={styles.input}
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            placeholder="At least 12 characters"
          />
        </label>

        <label
          className={styles.checkboxRow}
        >
          <input
            className={styles.checkbox}
            type="checkbox"
            name="termsAccepted"
            required
          />

          <span>
            I accept this storefront’s
            customer terms.
          </span>
        </label>

        <label
          className={styles.checkboxRow}
        >
          <input
            className={styles.checkbox}
            type="checkbox"
            name="privacyAccepted"
            required
          />

          <span>
            I accept the privacy notice
            and account data processing.
          </span>
        </label>

        <label
          className={styles.checkboxRow}
        >
          <input
            className={styles.checkbox}
            type="checkbox"
            name="marketingOptIn"
          />

          <span>
            Send me optional product and
            offer updates. I can change
            this later.
          </span>
        </label>

        {notice ? (
          <div
            className={
              notice.kind === "error"
                ? styles.errorNotice
                : styles.successNotice
            }
            role={
              notice.kind === "error"
                ? "alert"
                : "status"
            }
            aria-live="polite"
          >
            {notice.message}
          </div>
        ) : null}

        <button
          className={styles.primaryButton}
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Creating account…"
            : "Create storefront account"}
        </button>
      </form>

      <p className={styles.formFooter}>
        Already registered here?{" "}
        <Link
          href={storefront.loginHref}
          className={styles.inlineLink}
        >
          Sign in
        </Link>
        .
      </p>
    </>
  );
}
TS

echo
echo "=== CREATE VERIFICATION FORM ==="

cat > src/components/auth/verify-form.tsx <<'TS'
"use client";

import {
  type FormEvent,
  useState,
} from "react";
import Link from "next/link";

import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";

import styles from "./auth.module.css";

interface ApiPayload {
  error?: {
    message?: string;
  };
}

interface ChannelNotice {
  kind: "error" | "success";
  message: string;
}

async function payloadFrom(
  response: Response,
): Promise<ApiPayload> {
  try {
    return await response.json() as ApiPayload;
  } catch {
    return {};
  }
}

export function VerificationForm({
  storefront,
  initialEmailToken,
  initialPhoneChallengeId,
}: {
  storefront: StorefrontAuthConfig;
  initialEmailToken?: string;
  initialPhoneChallengeId?: string;
}) {
  const [
    emailNotice,
    setEmailNotice,
  ] = useState<ChannelNotice | null>(
    null,
  );

  const [
    phoneNotice,
    setPhoneNotice,
  ] = useState<ChannelNotice | null>(
    null,
  );

  const [
    emailSubmitting,
    setEmailSubmitting,
  ] = useState(false);

  const [
    phoneSubmitting,
    setPhoneSubmitting,
  ] = useState(false);

  async function verifyEmail(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const formData = new FormData(
      event.currentTarget,
    );

    setEmailNotice(null);
    setEmailSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/verify/email",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode:
              storefront.code,
            token:
              formData.get(
                "emailToken",
              ),
          }),
        },
      );

      const payload =
        await payloadFrom(response);

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
          "Email verification failed.",
        );
      }

      setEmailNotice({
        kind: "success",
        message:
          "Email verified successfully.",
      });
    } catch (error) {
      setEmailNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Email verification failed.",
      });
    } finally {
      setEmailSubmitting(false);
    }
  }

  async function verifyPhone(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const formData = new FormData(
      event.currentTarget,
    );

    setPhoneNotice(null);
    setPhoneSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/verify/phone",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode:
              storefront.code,
            challengeId:
              formData.get(
                "challengeId",
              ),
            code:
              formData.get(
                "phoneCode",
              ),
          }),
        },
      );

      const payload =
        await payloadFrom(response);

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
          "Phone verification failed.",
        );
      }

      setPhoneNotice({
        kind: "success",
        message:
          "Phone verified successfully. You can now sign in after both verification steps are complete.",
      });
    } catch (error) {
      setPhoneNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Phone verification failed.",
      });
    } finally {
      setPhoneSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Verify your account
        </h2>

        <p className={styles.panelText}>
          Both email and phone must be
          verified before you can place
          orders or reserve pickup.
        </p>
      </div>

      <div
        className={styles.verifyStack}
        data-auth-form="verify"
      >
        <section
          className={styles.verifyCard}
        >
          <h3
            className={styles.verifyTitle}
          >
            Email verification
          </h3>

          <p
            className={styles.verifyText}
          >
            Open the verification link
            sent to your registered email,
            or enter its secure token.
          </p>

          <form
            className={styles.form}
            onSubmit={verifyEmail}
          >
            <label
              className={styles.field}
            >
              <span
                className={styles.label}
              >
                Email verification token
              </span>

              <input
                className={styles.input}
                type="text"
                name="emailToken"
                defaultValue={
                  initialEmailToken
                }
                maxLength={256}
                required
                autoComplete="off"
              />
            </label>

            {emailNotice ? (
              <div
                className={
                  emailNotice.kind ===
                  "error"
                    ? styles.errorNotice
                    : styles.successNotice
                }
                role={
                  emailNotice.kind ===
                  "error"
                    ? "alert"
                    : "status"
                }
                aria-live="polite"
              >
                {emailNotice.message}
              </div>
            ) : null}

            <button
              className={
                styles.primaryButton
              }
              type="submit"
              disabled={emailSubmitting}
            >
              {emailSubmitting
                ? "Verifying email…"
                : "Verify email"}
            </button>
          </form>
        </section>

        <section
          className={styles.verifyCard}
        >
          <h3
            className={styles.verifyTitle}
          >
            Phone verification
          </h3>

          <p
            className={styles.verifyText}
          >
            Enter the challenge reference
            and one-time code delivered to
            your registered phone.
          </p>

          <form
            className={styles.form}
            onSubmit={verifyPhone}
          >
            <label
              className={styles.field}
            >
              <span
                className={styles.label}
              >
                Challenge reference
              </span>

              <input
                className={styles.input}
                type="text"
                name="challengeId"
                defaultValue={
                  initialPhoneChallengeId
                }
                maxLength={256}
                required
                autoComplete="off"
              />
            </label>

            <label
              className={styles.field}
            >
              <span
                className={styles.label}
              >
                Six-digit code
              </span>

              <input
                className={styles.input}
                type="text"
                name="phoneCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                minLength={6}
                maxLength={6}
                pattern="[0-9]{6}"
                required
                placeholder="000000"
              />
            </label>

            {phoneNotice ? (
              <div
                className={
                  phoneNotice.kind ===
                  "error"
                    ? styles.errorNotice
                    : styles.successNotice
                }
                role={
                  phoneNotice.kind ===
                  "error"
                    ? "alert"
                    : "status"
                }
                aria-live="polite"
              >
                {phoneNotice.message}
              </div>
            ) : null}

            <button
              className={
                styles.primaryButton
              }
              type="submit"
              disabled={phoneSubmitting}
            >
              {phoneSubmitting
                ? "Verifying phone…"
                : "Verify phone"}
            </button>
          </form>
        </section>
      </div>

      <p className={styles.formFooter}>
        Finished both steps?{" "}
        <Link
          href={storefront.loginHref}
          className={styles.inlineLink}
        >
          Sign in
        </Link>
        .
      </p>
    </>
  );
}
TS

echo
echo "=== CREATE PROTECTED ACCOUNT PANEL ==="

cat > src/components/auth/account-panel.tsx <<'TS'
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";

import styles from "./auth.module.css";

export interface AccountPanelSummary {
  email: string;
  phone: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
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

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

export function AccountPanel({
  storefront,
  summary,
}: {
  storefront: StorefrontAuthConfig;
  summary: AccountPanelSummary;
}) {
  const router = useRouter();

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const [
    logoutError,
    setLogoutError,
  ] = useState<string | null>(
    null,
  );

  const customerName =
    summary.profile.displayName ||
    [
      summary.profile.firstName,
      summary.profile.lastName,
    ].join(" ");

  async function logout(): Promise<void> {
    setLogoutError(null);
    setLoggingOut(true);

    try {
      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode:
              storefront.code,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          "Sign out could not be completed.",
        );
      }

      router.replace(
        storefront.loginHref,
      );

      router.refresh();
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Sign out could not be completed.",
      );

      setLoggingOut(false);
    }
  }

  return (
    <div
      className={styles.accountPanel}
      data-account-storefront={
        storefront.code
      }
    >
      <div className={styles.accountTop}>
        <div
          className={styles.accountIdentity}
        >
          <h2
            className={styles.accountName}
          >
            {customerName}
          </h2>

          <p
            className={styles.accountEmail}
          >
            {summary.email}
          </p>

          <span
            className={styles.statusPill}
          >
            Verified account
          </span>
        </div>

        <button
          className={styles.secondaryButton}
          type="button"
          onClick={logout}
          disabled={loggingOut}
        >
          {loggingOut
            ? "Signing out…"
            : "Sign out"}
        </button>
      </div>

      <div className={styles.accountGrid}>
        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Storefront
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {storefront.name}
          </p>
        </section>

        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Phone
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {summary.phone}
          </p>
        </section>

        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Account created
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {formatDate(
              summary.createdAt,
            )}
          </p>
        </section>

        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Last sign in
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {formatDate(
              summary.lastLoginAt,
            )}
          </p>
        </section>

        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Login alerts
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {summary.security
              .loginAlertsEnabled
              ? "Enabled"
              : "Disabled"}
          </p>
        </section>

        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Two-factor authentication
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {summary.security
              .twoFactorEnabled
              ? "Enabled"
              : "Optional — not enabled"}
          </p>
        </section>
      </div>

      {logoutError ? (
        <div
          className={styles.errorNotice}
          role="alert"
          aria-live="polite"
        >
          {logoutError}
        </div>
      ) : null}

      <div className={styles.accountActions}>
        <Link
          href={storefront.baseHref}
          className={styles.headerLink}
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
TS

echo
echo "=== CREATE SHARED AUTHENTICATION PAGES ==="

cat > src/components/auth/pages.tsx <<'TS'
import type {
  CSSProperties,
} from "react";
import Link from "next/link";

import {
  getAllStorefrontAuthConfigs,
  type StorefrontAuthConfig,
} from "../../lib/storefront-auth";
import {
  getCustomerAccountSummary,
} from "../../server/auth/account";
import {
  requireStorefrontSession,
} from "../../server/auth/page-session";

import {
  AccountPanel,
} from "./account-panel";
import {
  AuthShell,
} from "./auth-shell";
import {
  LoginForm,
  RegistrationForm,
} from "./auth-forms";
import {
  VerificationForm,
} from "./verify-form";

import styles from "./auth.module.css";

type SearchParams =
  Record<
    string,
    string |
    string[] |
    undefined
  >;

function firstSearchValue(
  value:
    | string
    | string[]
    | undefined,
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export function StorefrontLoginPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  return (
    <AuthShell
      storefront={storefront}
      title="Your store, remembered."
      description={
        storefront.description
      }
    >
      <LoginForm
        storefront={storefront}
      />
    </AuthShell>
  );
}

export function StorefrontRegisterPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  return (
    <AuthShell
      storefront={storefront}
      title="A private account for every order."
      description={
        "Create a verified account for this storefront. Your identity, cart and order history remain separated from every other SORVYRA store."
      }
    >
      <RegistrationForm
        storefront={storefront}
      />
    </AuthShell>
  );
}

export function StorefrontVerifyPage({
  storefront,
  searchParams,
}: {
  storefront: StorefrontAuthConfig;
  searchParams: SearchParams;
}) {
  return (
    <AuthShell
      storefront={storefront}
      title="Confirm it is really you."
      description={
        "Complete both verification channels to protect your account and unlock checkout, pickup reservations and order tracking."
      }
    >
      <VerificationForm
        storefront={storefront}
        initialEmailToken={
          firstSearchValue(
            searchParams.token,
          )
        }
        initialPhoneChallengeId={
          firstSearchValue(
            searchParams.challengeId,
          )
        }
      />
    </AuthShell>
  );
}

export async function StorefrontAccountPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  const session =
    await requireStorefrontSession(
      storefront.code,
      storefront.loginHref,
    );

  const summary =
    await getCustomerAccountSummary({
      userId: session.userId,
      storefrontId:
        session.storefrontId,
    });

  return (
    <AuthShell
      storefront={storefront}
      title="Your account, secured."
      description={
        "Review your verified storefront identity and continue managing purchases from one protected place."
      }
    >
      <AccountPanel
        storefront={storefront}
        summary={{
          email: summary.email,
          phone: summary.phone,
          status: summary.status,
          createdAt:
            summary.createdAt
              .toISOString(),
          lastLoginAt:
            summary.lastLoginAt
              ?.toISOString() ??
            null,
          profile: summary.profile,
          security: summary.security,
        }}
      />
    </AuthShell>
  );
}

export function GlobalAccountPortalPage() {
  const storefronts =
    getAllStorefrontAuthConfigs();

  return (
    <div
      className={styles.shell}
      data-auth-portal="global"
    >
      <div
        className={styles.ambientOne}
        aria-hidden="true"
      />
      <div
        className={styles.ambientTwo}
        aria-hidden="true"
      />

      <header className={styles.header}>
        <Link
          href="/"
          className={styles.brand}
        >
          <span
            className={styles.brandMark}
            aria-hidden="true"
          >
            S
          </span>

          <span
            className={styles.brandCopy}
          >
            <span
              className={styles.eyebrow}
            >
              Owned storefront network
            </span>

            <span
              className={styles.brandName}
            >
              SORVYRA STORE
            </span>
          </span>
        </Link>

        <nav
          className={styles.headerNav}
          aria-label="Store navigation"
        >
          <Link
            href="/"
            className={styles.headerLink}
          >
            Home
          </Link>

          <Link
            href="/shop"
            className={styles.headerLink}
          >
            Shop
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section
          className={styles.portalIntro}
        >
          <span className={styles.kicker}>
            Storefront accounts
          </span>

          <h1
            className={styles.portalTitle}
          >
            Choose the store you joined.
          </h1>

          <p
            className={styles.portalText}
          >
            Each SORVYRA storefront keeps
            its customer accounts, carts
            and orders separate. Select
            the exact store where you
            registered.
          </p>
        </section>

        <section
          className={styles.portalGrid}
        >
          {storefronts.map(
            (storefront) => {
              const cardStyle = {
                "--card-accent":
                  storefront.accent,
              } as CSSProperties;

              return (
                <Link
                  key={storefront.code}
                  href={
                    storefront.loginHref
                  }
                  className={
                    styles.portalCard
                  }
                  style={cardStyle}
                  data-portal-storefront={
                    storefront.code
                  }
                >
                  <span
                    className={
                      styles.portalCountry
                    }
                  >
                    {storefront.countryName}
                    {" · "}
                    {storefront.currencyCode}
                  </span>

                  <h2
                    className={
                      styles.portalName
                    }
                  >
                    {storefront.name}
                  </h2>

                  <span
                    className={
                      styles.portalAction
                    }
                  >
                    Open storefront account
                    →
                  </span>
                </Link>
              );
            },
          )}
        </section>
      </main>
    </div>
  );
}
TS

echo
echo "=== CREATE GLOBAL ACCOUNT PORTAL ROUTE ==="

mkdir -p src/app/account

cat > src/app/account/page.tsx <<'TS'
import {
  GlobalAccountPortalPage,
} from "../../components/auth/pages";

export default function AccountPortalPage() {
  return <GlobalAccountPortalPage />;
}
TS

echo
echo "=== GENERATE STOREFRONT ACCOUNT ROUTES ==="

python - <<'PY'
from pathlib import Path

storefronts = [
    (
        "src/app/ng/atiloszy/account",
        "ATI",
    ),
    (
        "src/app/ng/zee-beauty-fashion/account",
        "ZBF",
    ),
    (
        "src/app/ng/denald/account",
        "DEN",
    ),
    (
        "src/app/qa/zee-comfort-hub/account",
        "ZCH",
    ),
]

account_template = '''import {{
  StorefrontAccountPage,
}} from "../../../../components/auth/pages";
import {{
  getStorefrontAuthConfig,
}} from "../../../../lib/storefront-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const storefront =
  getStorefrontAuthConfig("{code}");

export default async function AccountPage() {{
  return (
    <StorefrontAccountPage
      storefront={{storefront}}
    />
  );
}}
'''

login_template = '''import {{
  StorefrontLoginPage,
}} from "../../../../../components/auth/pages";
import {{
  getStorefrontAuthConfig,
}} from "../../../../../lib/storefront-auth";

const storefront =
  getStorefrontAuthConfig("{code}");

export default function LoginPage() {{
  return (
    <StorefrontLoginPage
      storefront={{storefront}}
    />
  );
}}
'''

register_template = '''import {{
  StorefrontRegisterPage,
}} from "../../../../../components/auth/pages";
import {{
  getStorefrontAuthConfig,
}} from "../../../../../lib/storefront-auth";

const storefront =
  getStorefrontAuthConfig("{code}");

export default function RegisterPage() {{
  return (
    <StorefrontRegisterPage
      storefront={{storefront}}
    />
  );
}}
'''

verify_template = '''import {{
  StorefrontVerifyPage,
}} from "../../../../../components/auth/pages";
import {{
  getStorefrontAuthConfig,
}} from "../../../../../lib/storefront-auth";

type VerifyPageProps = {{
  searchParams: Promise<
    Record<
      string,
      string |
      string[] |
      undefined
    >
  >;
}};

const storefront =
  getStorefrontAuthConfig("{code}");

export default async function VerifyPage({{
  searchParams,
}}: VerifyPageProps) {{
  return (
    <StorefrontVerifyPage
      storefront={{storefront}}
      searchParams={{
        await searchParams
      }}
    />
  );
}}
'''

for base_value, code in storefronts:
    base = Path(base_value)

    (base / "login").mkdir(
        parents=True,
        exist_ok=True,
    )

    (base / "register").mkdir(
        parents=True,
        exist_ok=True,
    )

    (base / "verify").mkdir(
        parents=True,
        exist_ok=True,
    )

    (base / "page.tsx").write_text(
        account_template.format(
            code=code,
        ),
        encoding="utf-8",
    )

    (
        base /
        "login" /
        "page.tsx"
    ).write_text(
        login_template.format(
            code=code,
        ),
        encoding="utf-8",
    )

    (
        base /
        "register" /
        "page.tsx"
    ).write_text(
        register_template.format(
            code=code,
        ),
        encoding="utf-8",
    )

    (
        base /
        "verify" /
        "page.tsx"
    ).write_text(
        verify_template.format(
            code=code,
        ),
        encoding="utf-8",
    )

    print(
        f"Created account routes for {code}."
    )
PY

echo
echo "=== CREATE AUTHENTICATION PAGE AUDIT ==="

cat > scripts/audit-customer-auth-pages.ts <<'TS'
import {
  type ChildProcessByStdio,
  spawn,
} from "node:child_process";
import {
  randomBytes,
  randomInt,
} from "node:crypto";
import type {
  Readable,
} from "node:stream";

import { prisma } from "../src/lib/prisma";
import {
  normalizeEmail,
  registerCustomer,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";

type TestServer =
  ChildProcessByStdio<
    null,
    Readable,
    Readable
  >;

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForExit(
  server: TestServer,
  timeoutMilliseconds: number,
): Promise<boolean> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return true;
  }

  return new Promise((resolve) => {
    let settled = false;

    let timer:
      | ReturnType<typeof setTimeout>
      | null = null;

    const finish = (
      exited: boolean,
    ): void => {
      if (settled) {
        return;
      }

      settled = true;

      if (timer) {
        clearTimeout(timer);
      }

      server.removeListener(
        "exit",
        handleExit,
      );

      resolve(exited);
    };

    const handleExit = (): void => {
      finish(true);
    };

    server.once(
      "exit",
      handleExit,
    );

    timer = setTimeout(
      () => finish(false),
      timeoutMilliseconds,
    );

    if (
      server.exitCode !== null ||
      server.signalCode !== null
    ) {
      finish(true);
    }
  });
}

async function stopServer(
  server: TestServer,
): Promise<void> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return;
  }

  server.kill("SIGTERM");

  if (
    await waitForExit(
      server,
      5000,
    )
  ) {
    return;
  }

  server.kill("SIGKILL");

  await waitForExit(
    server,
    2000,
  );
}

async function main(): Promise<void> {
  console.log(
    "=== CUSTOMER AUTHENTICATION PAGE AUDIT ===",
  );

  const tokenSecret =
    process.env.AUTH_TOKEN_SECRET;

  assertCondition(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const suffix = randomBytes(8)
    .toString("hex");

  const email =
    `auth-pages-${suffix}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phoneSuffix =
    `${Date.now()}`.slice(-7);

  const phone =
    `+234703${phoneSuffix}`;

  const password =
    `Auth-Pages-Passphrase-${suffix}`;

  const registration =
    await registerCustomer({
      storefrontCode: "ATI",
      email,
      phone,
      password,
      firstName: "Account",
      lastName: "Page Audit",
      displayName: "Page Audit",
      marketingOptIn: false,
      termsAccepted: true,
      privacyAccepted: true,
      tokenSecret,
    });

  await verifyCustomerEmail({
    storefrontCode: "ATI",
    token:
      registration
        .emailVerificationToken,
    tokenSecret,
  });

  await verifyCustomerPhone({
    storefrontCode: "ATI",
    challengeId:
      registration.phoneChallengeId,
    code:
      registration
        .phoneVerificationCode,
    tokenSecret,
  });

  const port = randomInt(
    39001,
    45000,
  );

  const baseUrl =
    `http://127.0.0.1:${port}`;

  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      String(port),
      "-H",
      "127.0.0.1",
    ],
    {
      env: {
        ...process.env,
        APP_ORIGIN: baseUrl,
        AUTH_REGISTRATION_API_ENABLED:
          "false",
      },
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    },
  );

  let serverLogs = "";

  const captureLogs = (
    chunk: Buffer,
  ): void => {
    serverLogs = (
      serverLogs +
      chunk.toString("utf8")
    ).slice(-16000);
  };

  server.stdout.on(
    "data",
    captureLogs,
  );

  server.stderr.on(
    "data",
    captureLogs,
  );

  async function fetchPage(
    path: string,
    cookie?: string,
  ): Promise<Response> {
    return fetch(
      `${baseUrl}${path}`,
      {
        headers: cookie
          ? {
              Cookie: cookie,
            }
          : undefined,
        redirect: "manual",
      },
    );
  }

  try {
    let ready = false;

    for (
      let attempt = 0;
      attempt < 60;
      attempt += 1
    ) {
      if (server.exitCode !== null) {
        break;
      }

      try {
        const response =
          await fetch(baseUrl);

        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // Server is still starting.
      }

      await delay(500);
    }

    if (!ready) {
      throw new Error(
        "The production server did not become ready.\n" +
        serverLogs,
      );
    }

    console.log(
      "PASS: Production Next.js server started.",
    );

    const portalResponse =
      await fetchPage("/account");

    const portalHtml =
      await portalResponse.text();

    assertCondition(
      portalResponse.status === 200,
      "The global account portal did not load.",
    );

    for (
      const code of [
        "ATI",
        "ZBF",
        "DEN",
        "ZCH",
      ]
    ) {
      assertCondition(
        portalHtml.includes(
          `data-portal-storefront="${code}"`,
        ),
        `The account portal is missing ${code}.`,
      );
    }

    console.log(
      "PASS: Global storefront account portal completed.",
    );

    const storefrontPages = [
      {
        code: "ATI",
        base:
          "/ng/atiloszy/account",
      },
      {
        code: "ZBF",
        base:
          "/ng/zee-beauty-fashion/account",
      },
      {
        code: "DEN",
        base:
          "/ng/denald/account",
      },
      {
        code: "ZCH",
        base:
          "/qa/zee-comfort-hub/account",
      },
    ];

    for (
      const storefront of storefrontPages
    ) {
      for (
        const suffixPath of [
          "/login",
          "/register",
          "/verify",
        ]
      ) {
        const response =
          await fetchPage(
            storefront.base +
              suffixPath,
          );

        const html =
          await response.text();

        assertCondition(
          response.status === 200,
          `${storefront.code} ${suffixPath} did not load.`,
        );

        assertCondition(
          html.includes(
            `data-auth-storefront="${storefront.code}"`,
          ),
          `${storefront.code} branding was not rendered.`,
        );
      }
    }

    console.log(
      "PASS: All storefront authentication pages rendered.",
    );

    const unauthenticatedAccount =
      await fetchPage(
        "/ng/atiloszy/account",
      );

    assertCondition(
      (
        unauthenticatedAccount.status ===
          307 ||
        unauthenticatedAccount.status ===
          308
      ),
      "The protected account page did not redirect.",
    );

    const unauthenticatedLocation =
      unauthenticatedAccount.headers.get(
        "location",
      );

    assertCondition(
      unauthenticatedLocation?.includes(
        "/ng/atiloszy/account/login",
      ),
      "The protected page redirected to the wrong login page.",
    );

    console.log(
      "PASS: Unauthenticated account access redirects safely.",
    );

    const loginResponse = await fetch(
      `${baseUrl}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Origin: baseUrl,
        },
        body: JSON.stringify({
          storefrontCode: "ATI",
          email,
          password,
        }),
        redirect: "manual",
      },
    );

    assertCondition(
      loginResponse.status === 200,
      "The audit customer could not sign in.",
    );

    const setCookie =
      loginResponse.headers.get(
        "set-cookie",
      );

    assertCondition(
      setCookie,
      "The login response did not set a cookie.",
    );

    const cookiePair =
      setCookie.split(";")[0];

    const authenticatedAccount =
      await fetchPage(
        "/ng/atiloszy/account",
        cookiePair,
      );

    const authenticatedHtml =
      await authenticatedAccount.text();

    assertCondition(
      authenticatedAccount.status === 200,
      "The authenticated account page did not load.",
    );

    assertCondition(
      authenticatedHtml.includes(
        'data-account-storefront="ATI"',
      ),
      "The protected account panel was not rendered.",
    );

    assertCondition(
      authenticatedHtml.includes(
        normalizedEmail,
      ),
      "The protected page did not render the customer identity.",
    );

    assertCondition(
      !authenticatedHtml.includes(
        cookiePair.split("=")[1],
      ),
      "The account page exposed its raw session token.",
    );

    console.log(
      "PASS: Verified customer account page rendered securely.",
    );

    const crossStoreAccount =
      await fetchPage(
        "/ng/zee-beauty-fashion/account",
        cookiePair,
      );

    assertCondition(
      (
        crossStoreAccount.status ===
          307 ||
        crossStoreAccount.status ===
          308
      ),
      "An ATILOSZY cookie accessed another storefront account.",
    );

    const crossStoreLocation =
      crossStoreAccount.headers.get(
        "location",
      );

    assertCondition(
      crossStoreLocation?.includes(
        "/ng/zee-beauty-fashion/account/login",
      ),
      "Cross-store access did not redirect to the correct login.",
    );

    console.log(
      "PASS: Protected account pages remain storefront-isolated.",
    );

    const logoutResponse = await fetch(
      `${baseUrl}/api/auth/logout`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Origin: baseUrl,
          Cookie: cookiePair,
        },
        body: JSON.stringify({
          storefrontCode: "ATI",
        }),
        redirect: "manual",
      },
    );

    assertCondition(
      logoutResponse.status === 200,
      "Logout failed during the page audit.",
    );

    const afterLogout =
      await fetchPage(
        "/ng/atiloszy/account",
        cookiePair,
      );

    assertCondition(
      (
        afterLogout.status === 307 ||
        afterLogout.status === 308
      ),
      "A revoked cookie still accessed the account page.",
    );

    console.log(
      "PASS: Logout revokes protected page access.",
    );

    console.log(
      "PASS: Customer authentication page audit completed.",
    );
  } catch (error) {
    if (serverLogs) {
      console.error(
        "=== PRODUCTION SERVER LOG TAIL ===",
      );

      console.error(serverLogs);
    }

    throw error;
  } finally {
    await stopServer(server);

    await prisma.user.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    console.log(
      "PASS: Temporary authentication page audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
TS

echo
echo "=== REGISTER AUTHENTICATION PAGE AUDIT ==="

npm pkg set \
  "scripts.db:audit:auth-ui=node --env-file=.env --conditions=react-server --import tsx scripts/audit-customer-auth-pages.ts"

echo
echo "=== VALIDATE DATABASE STATE ==="

npm run db:up
npm run db:validate
npm run db:generate
npx prisma migrate status

echo
echo "=== RUN AUTHENTICATION REGRESSION AUDITS ==="

npm run db:audit:auth
npm run db:audit:auth-api
npm run db:audit:identity

echo
echo "=== RUN COMMERCE REGRESSION AUDITS ==="

npm run db:audit
npm run db:audit:catalog
npm run db:audit:services

echo
echo "=== RUN APPLICATION VALIDATION ==="

npm run lint
npm run build

echo
echo "=== RUN AUTHENTICATION PAGE AUDIT ==="

npm run db:audit:auth-ui

echo
echo "=== VERIFY DATABASE CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TS'
import { prisma } from "./src/lib/prisma";

const remainingUsers =
  await prisma.user.count({
    where: {
      normalizedEmail: {
        contains: "auth-pages-",
        endsWith: "@example.test",
      },
    },
  });

if (remainingUsers !== 0) {
  throw new Error(
    `${remainingUsers} temporary page audit user(s) remain.`,
  );
}

console.log(
  "PASS: No temporary authentication page users remain.",
);

await prisma.$disconnect();
TS

echo
echo "=== VERIFY NO TEST SERVER REMAINS ==="

if ps -ef |
  grep -E \
    '[n]ode_modules/next/dist/bin/next start' \
  >/tmp/sorvyra-auth-ui-server-check.txt
then
  echo "A temporary authentication page server remains:"
  cat /tmp/sorvyra-auth-ui-server-check.txt
  exit 1
fi

echo "PASS: No authentication page test server remains."

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "PHASE 2E-D CUSTOMER AUTHENTICATION PAGES PASSED"
