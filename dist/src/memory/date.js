const dayFormat = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: process.env.FEED_THE_SEEK_TIMEZONE || undefined,
});
/** The user's local calendar day (the machine's time zone, or FEED_THE_SEEK_TIMEZONE), not the UTC day. */
export function localDay(time) {
    return dayFormat.format(time);
}
//# sourceMappingURL=date.js.map