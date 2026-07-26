import {
  StorefrontLoginPage,
} from "../../../../../components/auth/pages";
import {
  getStorefrontAuthConfig,
} from "../../../../../lib/storefront-auth";

const storefront =
  getStorefrontAuthConfig("DEN");

export default function LoginPage() {
  return (
    <StorefrontLoginPage
      storefront={storefront}
    />
  );
}
