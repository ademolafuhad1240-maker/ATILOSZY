import { products } from '@/data/products';
import { categories } from '@/data/categories';

export function getProductBySlug(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(categorySlug: string) {
  return products.filter((p) => p.categorySlug === categorySlug);
}

export function getFeaturedProducts() {
  return products.filter((p) => p.featured).slice(0, 6);
}

export function getNewArrivals() {
  return products.filter((p) => p.isNew).slice(0, 6);
}

export function getCategoryBySlug(slug: string) {
  return categories.find((c) => c.slug === slug);
}
