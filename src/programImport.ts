// src/programImport.ts — validation for imported program JSON (pure, testable).
import { clampInt } from "./format";

export type ImportPayload = {
  name: string;
  days: { name: string; blocks: { type: string; exId?: string; ex?: string; a?: string; b?: string; c?: string }[] }[];
};

export type ImportResult =
  | { ok: true; program: ImportPayload }
  | { ok: false; errorKey: string };

/**
 * Validate an arbitrary parsed JSON payload as a Gymdash program export.
 * Returns the typed program on success, or an i18n error key on failure.
 */
export function validateImport(payload: unknown): ImportResult {
  if (!payload || typeof payload !== "object") return { ok: false, errorKey: "program.invalidJson" };
  const p = payload as ImportPayload;
  if (!p.name || typeof p.name !== "string") return { ok: false, errorKey: "program.mustHaveName" };
  if (!Array.isArray(p.days) || p.days.length < 1 || p.days.length > 10) {
    return { ok: false, errorKey: "program.mustHave1to10Days" };
  }

  for (const day of p.days) {
    if (!day || typeof day.name !== "string" || !Array.isArray(day.blocks)) {
      return { ok: false, errorKey: "program.invalidDayFormat" };
    }
    for (const block of day.blocks) {
      if (!block || typeof block.type !== "string") return { ok: false, errorKey: "program.invalidBlock" };
      if (block.type === "single") {
        const exId = block.exId ?? block.ex;
        if (!exId || typeof exId !== "string") return { ok: false, errorKey: "program.singleMissingExId" };
      } else if (block.type === "superset") {
        if (!block.a || !block.b || typeof block.a !== "string" || typeof block.b !== "string") {
          return { ok: false, errorKey: "program.supersetMissingAB" };
        }
        if (block.c != null && typeof block.c !== "string") {
          return { ok: false, errorKey: "program.supersetMissingAB" };
        }
      } else {
        return { ok: false, errorKey: "program.unknownBlockType" };
      }
    }
  }

  return { ok: true, program: p };
}

/** One exercise target from a shared program (Settings → Share program, schemaVersion 1). */
export type ShareTarget = {
  exerciseId: string;
  dayIndex: number;
  repMin: number;
  repMax: number;
  /** Missing in exports made before sets were shared — the caller falls back to the exercise default. */
  targetSets?: number;
  /** Missing or non-positive — the caller falls back to the exercise default. */
  incrementKg?: number;
  autoProgress?: boolean;
};

/**
 * Normalise the `targets` array of a shared program. Entries without an
 * exercise id or a numeric rep range are dropped; everything else is clamped
 * to the same limits as the target editor (reps 1–30 / up to 40, sets 1–10).
 */
export function parseShareTargets(raw: unknown): ShareTarget[] {
  if (!Array.isArray(raw)) return [];
  const out: ShareTarget[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.exerciseId !== "string" || !e.exerciseId) continue;
    if (typeof e.repMin !== "number" || !Number.isFinite(e.repMin)) continue;
    if (typeof e.repMax !== "number" || !Number.isFinite(e.repMax)) continue;

    const repMin = clampInt(e.repMin, 1, 30);
    const target: ShareTarget = {
      exerciseId: e.exerciseId,
      dayIndex: typeof e.dayIndex === "number" && Number.isFinite(e.dayIndex) ? Math.max(0, Math.trunc(e.dayIndex)) : 0,
      repMin,
      repMax: clampInt(e.repMax, repMin, 40),
    };
    if (typeof e.targetSets === "number" && Number.isFinite(e.targetSets)) {
      target.targetSets = clampInt(e.targetSets, 1, 10);
    }
    if (typeof e.incrementKg === "number" && Number.isFinite(e.incrementKg) && e.incrementKg > 0) {
      target.incrementKg = e.incrementKg;
    }
    if (typeof e.autoProgress === "boolean") target.autoProgress = e.autoProgress;
    out.push(target);
  }
  return out;
}
