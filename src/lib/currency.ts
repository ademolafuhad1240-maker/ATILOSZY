import { STORE_CONFIG } from '@/config/store';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(STORE_CONFIG.locale, {
    style: 'currency',
    currency: STORE_CONFIG.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPrice(price: number, compareAtPrice?: number): string {
  const formatted = formatCurrency(price);
  if (compareAtPrice && compareAtPrice > price) {
    return `${formatted}`;
  }
  return formatted;
}
