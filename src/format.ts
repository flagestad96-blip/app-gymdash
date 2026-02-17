export function formatWeight(n: number) {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function mmss(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function shortLabel(name: string) {
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  if (!clean) return name.slice(0, 6).toUpperCase();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 6).toUpperCase();
  return `${parts[0].slice(0, 3)}${parts[1].slice(0, 3)}`.toUpperCase();
}

export function parseTimeMs(iso: string | null | undefined) {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

export function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
