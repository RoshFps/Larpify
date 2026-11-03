export interface QuietHours {
  enabled: boolean;
  /** Hour of day, 0–23, local time. */
  start: number;
  end: number;
}

/** True when `date` falls in [start, end), wrapping past midnight when start > end. */
export function isQuietTime(date: Date, { enabled, start, end }: QuietHours): boolean {
  if (!enabled || start === end) return false;
  const hour = date.getHours();
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${suffix}`;
}
