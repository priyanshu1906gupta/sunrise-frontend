/** Normalize API / form values to `yyyy-mm-dd` for `<input type="date">`. */
export function toYmd(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value ?? '');
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (iso) return iso[1];
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toYmd(parsed);
  return toYmd(new Date());
}

/** Add calendar months to a `yyyy-mm-dd` value (same overflow rules as the API). */
export function addMonthsYmd(ymd: string, months: number): string {
  const [year, month, day] = toYmd(ymd).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setMonth(date.getMonth() + months);
  return toYmd(date);
}
