/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single source of truth (Commander M-7) for "today" as a local YYYY-MM-DD
 * string. Sprint 05 replaced every hardcoded '2026-07-02' across the app
 * with real system time — these helpers use local date components (not
 * Date.toISOString(), which is UTC and can shift the date near midnight in
 * Sarajevo's UTC+1/+2 offset).
 */

export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return formatDateLocal(new Date());
}

const BOSNIAN_MONTH_NAMES_LOWER = [
  'januar', 'februar', 'mart', 'april', 'maj', 'juni',
  'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar',
];

const BOSNIAN_MONTH_NAMES_TITLE = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar',
];

// Index matches Date.getDay() (0 = Sunday).
const BOSNIAN_WEEKDAY_NAMES = [
  'Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota',
];

export function getBosnianMonthName(monthIndex: number, capitalize = false): string {
  return capitalize ? BOSNIAN_MONTH_NAMES_TITLE[monthIndex] : BOSNIAN_MONTH_NAMES_LOWER[monthIndex];
}

/**
 * "Četvrtak, 9. juli 2026." — built manually rather than via
 * `date.toLocaleDateString('bs-BA', {...})`. Some browser/ICU builds don't
 * ship full Bosnian locale data and silently fall back to a garbled format
 * (observed: "M07 Thu" instead of "juli Četvrtak") instead of throwing, so
 * relying on Intl for bs-BA weekday/month names is not safe here.
 */
export function formatDateBosnianLong(date: Date, padDay = false): string {
  const weekday = BOSNIAN_WEEKDAY_NAMES[date.getDay()];
  const day = padDay ? String(date.getDate()).padStart(2, '0') : String(date.getDate());
  const month = getBosnianMonthName(date.getMonth());
  const year = date.getFullYear();
  return `${weekday}, ${day}. ${month} ${year}.`;
}

/** Sept 1 – Aug 31 school year range containing `date` (defaults to now). */
export function getCurrentSchoolYearRange(date: Date = new Date()): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed; August = 7, September = 8
  const startYear = month >= 8 ? year : year - 1;
  return {
    startDate: `${startYear}-09-01`,
    endDate: `${startYear + 1}-08-31`,
    label: `${startYear}/${startYear + 1}`,
  };
}
