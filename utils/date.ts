/**
 * Format a date as MM/DD/YYYY.
 * Accepts Date, date string, or ISO string.
 */
export function formatDateMMDDYYYY(value: Date | string | null | undefined): string {
  if (value == null) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}
