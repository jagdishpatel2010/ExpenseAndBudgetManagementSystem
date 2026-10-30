/**
 * Formatting utilities shared across screens.
 */
import { CURRENCY } from '../config';

/**
 * Format a number as an Indian Rupee currency string.
 *
 * @param {number} amount - The value to format.
 * @param {boolean} [withSymbol=true] - Include the ₹ symbol when true.
 * @returns {string} The formatted currency string, e.g. "₹1,250.00".
 */
export function formatCurrency(amount, withSymbol = true) {
  const n = Number.isFinite(amount) ? amount : 0;
  const formatted = n.toLocaleString(CURRENCY.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `${CURRENCY.symbol}${formatted}` : formatted;
}

/**
 * Format an ISO date (YYYY-MM-DD) into a short, readable label.
 *
 * @param {string} isoDate - Date string in YYYY-MM-DD form.
 * @returns {string} e.g. "27 Oct 2026". Falls back to the input on parse fail.
 */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Return today's date as an ISO YYYY-MM-DD string in local time.
 * @returns {string}
 */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Return the current month key as YYYY-MM in local time.
 * @returns {string}
 */
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
