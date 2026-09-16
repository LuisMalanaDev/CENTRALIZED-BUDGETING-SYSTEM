/**
 * Parses date range query parameters (e.g., "2026-09-15" or ISO strings) into UTC Date bounds.
 * Automatically expands YYYY-MM-DD end dates to 23:59:59.999 and applies the timezone offset
 * (defaulting to +08:00 for Asia/Manila) so transactions created throughout the day are matched.
 */
export function parseDateBounds(
  startDateStr?: string,
  endDateStr?: string,
  timezoneOffset?: string
): { startDate?: Date; endDate?: Date } {
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  let tz = '+08:00'; // Default to Philippine Standard Time
  if (timezoneOffset) {
    if (timezoneOffset.startsWith('+') || timezoneOffset.startsWith('-')) {
      tz = timezoneOffset.includes(':') ? timezoneOffset : `${timezoneOffset}:00`;
    } else if (
      timezoneOffset === 'Asia/Manila' ||
      timezoneOffset.includes('Manila') ||
      timezoneOffset.includes('PH')
    ) {
      tz = '+08:00';
    } else if (/^\d+$/.test(timezoneOffset)) {
      tz = `+${timezoneOffset.padStart(2, '0')}:00`;
    }
  }

  if (startDateStr && startDateStr.trim() !== '') {
    const s = startDateStr.trim();
    let d: Date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      d = new Date(`${s}T00:00:00.000${tz}`);
    } else {
      d = new Date(s);
    }
    if (!isNaN(d.getTime())) {
      startDate = d;
    }
  }

  if (endDateStr && endDateStr.trim() !== '') {
    const e = endDateStr.trim();
    let d: Date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(e)) {
      d = new Date(`${e}T23:59:59.999${tz}`);
    } else {
      d = new Date(e);
    }
    if (!isNaN(d.getTime())) {
      endDate = d;
    }
  }

  return { startDate, endDate };
}
