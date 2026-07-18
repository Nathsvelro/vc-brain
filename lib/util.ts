export function normalizeName(name: string): string {
  const stripped = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Non-Latin names would strip to "" and every one of them would collide;
  // fall back to the raw lowercased name so each stays distinct.
  return stripped || name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US")}`;
}
