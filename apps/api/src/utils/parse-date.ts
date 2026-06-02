import { getDate, getMonth, getYear, isValid, parse, parseISO } from "date-fns";

const DATE_FORMATS = [
  "yyyy-MM-dd",
  "dd-MM-yyyy",
  "MM-dd-yyyy",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "dd MMM yyyy",
  "MMM dd, yyyy",
  "MMMM dd, yyyy",
  "dd MMMM yyyy"
];

export const parseCertificateDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = parseISO(trimmed);
  if (isValid(iso)) {
    return new Date(Date.UTC(getYear(iso), getMonth(iso), getDate(iso)));
  }

  for (const format of DATE_FORMATS) {
    const parsed = parse(trimmed, format, new Date());
    if (isValid(parsed)) {
      return new Date(Date.UTC(getYear(parsed), getMonth(parsed), getDate(parsed)));
    }
  }

  const fallback = new Date(trimmed);
  return isValid(fallback) ? new Date(Date.UTC(getYear(fallback), getMonth(fallback), getDate(fallback))) : null;
};

export const toIsoDateString = (date: Date | null | undefined) =>
  date ? date.toISOString().slice(0, 10) : null;
