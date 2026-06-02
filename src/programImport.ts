// src/programImport.ts — validation for imported program JSON (pure, testable).

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
