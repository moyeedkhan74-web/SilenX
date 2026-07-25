/**
 * Formats a last seen date string or Date object into a relative text status
 * similar to WhatsApp or Telegram.
 * E.g., "recently", "5 minutes ago", "today at 12:45 PM", "yesterday at 3:15 PM", etc.
 */
export function formatLastSeen(lastSeenVal: string | Date | undefined | null): string {
  if (!lastSeenVal) return 'Offline';

  const date = new Date(lastSeenVal);
  if (isNaN(date.getTime())) return 'Offline';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  // If the time difference is negative (e.g. slight clock drift), treat as recently
  if (diffMs < 0) {
    return 'recently';
  }

  const diffMins = Math.floor(diffMs / 60000);

  // If less than a minute
  if (diffMins < 1) {
    return 'recently';
  }

  // If less than 60 minutes
  if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  }

  // Format time (HH:MM AM/PM)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  // Today
  if (date.toDateString() === now.toDateString()) {
    return `today at ${timeStr}`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `yesterday at ${timeStr}`;
  }

  // Same year
  if (date.getFullYear() === now.getFullYear()) {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `on ${date.toLocaleDateString([], options)} at ${timeStr}`;
  }

  // Different year
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return `on ${date.toLocaleDateString([], options)} at ${timeStr}`;
}

/**
 * Formats a message ISO date string or Date object into user's local time string (e.g., "4:48 PM").
 */
export function formatMessageTime(val?: string | Date | null): string {
  if (!val) return '';
  const date = new Date(val);
  if (isNaN(date.getTime())) {
    if (typeof val === 'string' && val.trim().length > 0) return val;
    return '';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}
