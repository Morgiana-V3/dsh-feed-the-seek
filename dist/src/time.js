const dayFormat = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: process.env.YUWEN_TIMEZONE || undefined });
/** The user's local calendar day (the machine's time zone, or YUWEN_TIMEZONE), not the UTC day. */
export function localDay(time) { return dayFormat.format(time); }
//# sourceMappingURL=time.js.map