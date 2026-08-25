// src/components/workout/superset.ts — shared superset slot constants + helpers.

import type { SetRow } from "./SetEntryRow";

export type SupersetSlotKey = "a" | "b" | "c";
export type SupersetLogPhase = "transition" | "round" | "final";

/** Fixed per-slot identity colors (A/B/C), independent of the accent palette. */
export const SLOT_COLORS: Record<SupersetSlotKey, string> = {
  a: "#c084fc", // aurora violet
  b: "#f59e0b", // amber
  c: "#ec4899", // pink
};

export const SLOT_LABELS: Record<SupersetSlotKey, string> = { a: "A", b: "B", c: "C" };

/** Count of working (non-warmup) sets. */
export function workingCount(sets: SetRow[]): number {
  return sets.filter((s) => !s.is_warmup).length;
}

// ── Manual supersets (created mid-session from the log screen) ───────────────

/** Structural mirror of the log screen's RenderBlock union. */
export type MergeableBlock =
  | {
      type: "single";
      exId: string;
      baseExId: string;
      anchorKey: string;
    }
  | {
      type: "superset";
      a: string;
      b: string;
      c?: string;
      baseA: string;
      baseB: string;
      baseC?: string;
      anchorKey: string;
      /** True when the superset was created mid-session (ungroupable). */
      manual?: boolean;
    };

export function manualSupersetAnchorKey(baseExIds: string[]): string {
  return `mss_${baseExIds.join("_")}`;
}

/**
 * Split program-defined supersets into single blocks for this session only.
 *
 * `splitKeys` holds the anchor keys of program superset blocks the user chose
 * to run separately today (machine taken, stations far apart, …) — the
 * program itself is untouched and the next session groups them again. Runs
 * BEFORE mergeManualSupersets so a split pair can even be re-linked manually.
 * Manual (mid-session) supersets are never split here; ungrouping handles those.
 */
export function splitProgramSupersets(blocks: MergeableBlock[], splitKeys: string[]): MergeableBlock[] {
  if (splitKeys.length === 0) return blocks;
  const keys = new Set(splitKeys);
  const result: MergeableBlock[] = [];
  for (const bl of blocks) {
    if (bl.type !== "superset" || bl.manual || !keys.has(bl.anchorKey)) {
      result.push(bl);
      continue;
    }
    result.push({ type: "single", exId: bl.a, baseExId: bl.baseA, anchorKey: `${bl.anchorKey}_a` });
    result.push({ type: "single", exId: bl.b, baseExId: bl.baseB, anchorKey: `${bl.anchorKey}_b` });
    if (bl.c && bl.baseC) {
      result.push({ type: "single", exId: bl.c, baseExId: bl.baseC, anchorKey: `${bl.anchorKey}_c` });
    }
  }
  return result;
}

/**
 * Rotate superset slot order for this session (A/B → B/A, A/B/C → B/C/A, …).
 *
 * `rotations` maps a superset block's anchor key to how many left-rotations to
 * apply. Sets stay attached to their exercises — only the slot order (and thus
 * the round logging order) changes. Works for program and manual supersets.
 */
export function applySupersetRotations(
  blocks: MergeableBlock[],
  rotations: Record<string, number>,
): MergeableBlock[] {
  const keys = Object.keys(rotations);
  if (keys.length === 0) return blocks;
  return blocks.map((bl) => {
    if (bl.type !== "superset") return bl;
    const slotCount = bl.c ? 3 : 2;
    const n = ((rotations[bl.anchorKey] ?? 0) % slotCount + slotCount) % slotCount;
    if (n === 0) return bl;
    const ex = [bl.a, bl.b, ...(bl.c ? [bl.c] : [])];
    const base = [bl.baseA, bl.baseB, ...(bl.baseC ? [bl.baseC] : [])];
    const rot = (arr: string[]) => arr.slice(n).concat(arr.slice(0, n));
    const [a, b, c] = rot(ex);
    const [baseA, baseB, baseC] = rot(base);
    return {
      ...bl,
      a,
      b,
      baseA,
      baseB,
      ...(c ? { c, baseC } : {}),
    };
  });
}

/**
 * Merge session-created superset groups into a render-block list.
 *
 * Each group holds 2–3 *base* exercise ids referring to single blocks (program
 * or ad-hoc). Group order decides slot order (A/B/C). Members that are no
 * longer present as singles (day changed, already inside a program superset)
 * are skipped, and a group needs at least 2 present members to merge. The
 * merged block takes the position of the group's first present member.
 */
export function mergeManualSupersets(blocks: MergeableBlock[], groups: string[][]): MergeableBlock[] {
  let result = blocks;
  for (const group of groups) {
    if (!Array.isArray(group) || group.length < 2) continue;
    const members: { exId: string; baseExId: string; index: number }[] = [];
    for (const baseId of group.slice(0, 3)) {
      if (members.some((m) => m.baseExId === baseId)) continue;
      const idx = result.findIndex((bl) => bl.type === "single" && bl.baseExId === baseId);
      if (idx < 0) continue;
      const bl = result[idx] as Extract<MergeableBlock, { type: "single" }>;
      members.push({ exId: bl.exId, baseExId: bl.baseExId, index: idx });
    }
    if (members.length < 2) continue;
    const [a, b, c] = members;
    const merged: MergeableBlock = {
      type: "superset",
      a: a.exId,
      b: b.exId,
      baseA: a.baseExId,
      baseB: b.baseExId,
      ...(c ? { c: c.exId, baseC: c.baseExId } : {}),
      anchorKey: manualSupersetAnchorKey(members.map((m) => m.baseExId)),
      manual: true,
    };
    const removeIdx = new Set(members.map((m) => m.index));
    const insertAt = Math.min(...members.map((m) => m.index));
    const next: MergeableBlock[] = [];
    result.forEach((bl, i) => {
      if (i === insertAt) next.push(merged);
      if (!removeIdx.has(i)) next.push(bl);
    });
    result = next;
  }
  return result;
}
