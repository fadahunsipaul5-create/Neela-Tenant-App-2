/**
 * Format date as MM/DD/YYYY (local timezone) for consistent display across the app.
 * All dates shown to users use this format and are in local time.
 * Use for due dates, notices, and any user-facing dates.
 */
export function formatDateMMDDYYYY(date: Date | string | number): string {
  const d = typeof date === 'object' && 'getTime' in date ? date : new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}
