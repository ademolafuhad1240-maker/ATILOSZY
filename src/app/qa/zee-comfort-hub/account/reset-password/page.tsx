import {
  StorefrontResetPasswordPage,
} from "../../../../../components/auth/pages";
import {
  getStorefrontAuthConfig,
} from "../../../../../lib/storefront-auth";

type ResetPasswordPageProps = {
  searchParams: Promise<
    Record<
      string,
      string |
      string[] |
      undefined
    >
  >;
};

const storefront =
  getStorefrontAuthConfig("ZCH");

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  return (
    <StorefrontResetPasswordPage
      storefront={storefront}
      searchParams={
        await searchParams
      }
    />
  );
}
