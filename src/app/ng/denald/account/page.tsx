import {
  StorefrontAccountPage,
} from "../../../../components/auth/pages";
import {
  getStorefrontAuthConfig,
} from "../../../../lib/storefront-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const storefront =
  getStorefrontAuthConfig("DEN");

export default async function AccountPage() {
  return (
    <StorefrontAccountPage
      storefront={storefront}
    />
  );
}
