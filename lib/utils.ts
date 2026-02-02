/**
 * Utility Functions
 * Kept from original but updated for Prisma/NextAuth
 */

/**
 * Generate a unique affiliate code for a user
 * Format: First 3 letters of name + random 6 digit number
 */
export function generateAffiliateCode(name: string): string {
  const prefix = name
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
  
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${randomNum}`;
}

/**
 * Format currency amount (Kenya Shillings)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get visitor IP from request headers
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0] ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Convert Prisma Decimal to number for safe JSON serialization
 */
export function decimalToNumber(decimal: any): number {
  if (typeof decimal === 'number') return decimal;
  return parseFloat(decimal.toString());
}
