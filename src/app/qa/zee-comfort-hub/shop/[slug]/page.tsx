import {
  StorefrontLiveProductPage,
} from '@/components/catalog/storefront-live-product-page';

export const dynamic =
  'force-dynamic';

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function ProductPage({
  params,
}: ProductPageProps) {
  const {
    slug,
  } = await params;

  return (
    <StorefrontLiveProductPage
      storefrontCode="ZCH"
      slug={slug}
    />
  );
}
