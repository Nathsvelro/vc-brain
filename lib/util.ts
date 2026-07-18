export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US")}`;
}
