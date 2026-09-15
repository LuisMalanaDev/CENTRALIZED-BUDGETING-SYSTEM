/**
 * Parses date range query parameters (e.g., "2026-09-15" or ISO strings) into UTC Date bounds.
 * Automatically expands YYYY-MM-DD end dates to 23:59:59.999 and applies the timezone offset
 * (defaulting to +08:00 for Asia/Manila) so transactions created throughout the day are matched.
 */
export function parseDateBounds(
  startDateStr?: string,
  endDateStr?: string,
  timezoneOffset: string = '+08:00'
): { startDate?: Date; endDate?: Date } {
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  const tz = timezoneOffset.startsWith('+') || timezoneOffset.startsWith('-')
    ? timezoneOffset
    : `+${timezoneOffset.padStart(2, '0')}:00`;

  if (startDateStr) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
      startDate = new Date(`${startDateStr}T00:00:00.000${tz}`);
    } else {
      startDate = new Date(startDateStr);
    }
  }

  if (endDateStr) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
      endDate = new Date(`${endDateStr}T23:59:59.999${tz}`);
    } else {
      endDate = new Date(endDateStr);
    }
  }

  return { startDate, endDate };
}
