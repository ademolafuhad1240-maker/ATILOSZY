import {
  StorefrontVerifyPage,
} from "../../../../../components/auth/pages";
import {
  getStorefrontAuthConfig,
} from "../../../../../lib/storefront-auth";

type VerifyPageProps = {
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
  getStorefrontAuthConfig("DEN");

export default async function VerifyPage({
  searchParams,
}: VerifyPageProps) {
  return (
    <StorefrontVerifyPage
      storefront={storefront}
      searchParams={
        await searchParams
      }
    />
  );
}
