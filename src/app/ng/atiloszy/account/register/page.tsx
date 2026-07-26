import {
  StorefrontRegisterPage,
} from "../../../../../components/auth/pages";
import {
  getStorefrontAuthConfig,
} from "../../../../../lib/storefront-auth";

const storefront =
  getStorefrontAuthConfig("ATI");

export default function RegisterPage() {
  return (
    <StorefrontRegisterPage
      storefront={storefront}
    />
  );
}
