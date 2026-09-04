export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function hostFromUrl(value: string): string {
  try {
    return new URL(normalizeUrl(value)).hostname;
  } catch {
    return value.replace(/^https?:\/\//i, "").split("/")[0] || "example.com";
  }
}

export function favLetter(value: string): string {
  return hostFromUrl(value).charAt(0).toUpperCase() || "W";
}
