const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function parseUtcTimestamp(isoDate: string): number {
  const normalized =
    isoDate.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(isoDate) ? isoDate : `${isoDate}Z`;
  return Date.parse(normalized);
}

export function formatRelativeTime(isoDate: string, nowMs: number = Date.now()): string {
  const timestamp = parseUtcTimestamp(isoDate);
  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffSeconds = Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  if (diffSeconds < 45) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return rtf.format(-diffMinutes, "minute");
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return rtf.format(-diffHours, "hour");
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return rtf.format(-diffDays, "day");
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return rtf.format(-diffMonths, "month");
  }

  const diffYears = Math.floor(diffDays / 365);
  return rtf.format(-Math.max(1, diffYears), "year");
}
