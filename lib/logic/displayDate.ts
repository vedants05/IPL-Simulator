/** Format a calendar date for display. Stored date keys remain YYYY-MM-DD. */
export function formatDisplayDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return value;
  }
  if (Number.isNaN(value.getTime())) return "";
  return `${String(value.getDate()).padStart(2, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${value.getFullYear()}`;
}

export function formatDisplayDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? formatDisplayDate(value) : "";
  return `${formatDisplayDate(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDateKeysInText(value: string): string {
  return value.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (dateKey) => formatDisplayDate(dateKey));
}
