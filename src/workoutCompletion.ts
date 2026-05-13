// src/workoutCompletion.ts
//
// Pure logic for the «all planned sets done» auto-end prompt. Extracted
// from app/(tabs)/log.tsx so it can be unit-tested without a render layer.

export type CompletionBlock =
  | { type: "single"; exId: string }
  | { type: "superset"; a: string; b: string; c?: string };

export type CompletionSet = { is_warmup?: number | boolean | null };

export type CompletionTarget = { targetSets: number };

export type CompletionInputs = {
  blocks: CompletionBlock[];
  setsByExercise: Record<string, CompletionSet[]>;
  adHocSet: ReadonlySet<string>;
  getTarget: (exId: string) => CompletionTarget;
};

/**
 * Returns true when every planned (non-ad-hoc) exercise in the workout
 * has hit its `targetSets` count of non-warmup sets, AND at least one
 * exercise has a target defined.
 *
 * Returns false:
 *   - when no exercise has a target (so the prompt never fires for
 *     programs without explicit set targets)
 *   - when any planned exercise still owes a working set
 *   - when blocks is empty
 *
 * Ad-hoc exercises are excluded from the completion check — adding an
 * ad-hoc lift mid-workout shouldn't block the «all done» prompt for
 * the planned program.
 */
export function areAllPlannedSetsDone(input: CompletionInputs): boolean {
  if (input.blocks.length === 0) return false;

  let anyTargetDefined = false;

  for (const block of input.blocks) {
    const exIds: string[] = block.type === "single"
      ? [block.exId]
      : block.c ? [block.a, block.b, block.c] : [block.a, block.b];

    for (const eid of exIds) {
      if (input.adHocSet.has(eid)) continue;
      const tgt = input.getTarget(eid);
      if (tgt.targetSets <= 0) continue;
      anyTargetDefined = true;
      const working = (input.setsByExercise[eid] ?? []).filter((s) => !s.is_warmup).length;
      if (working < tgt.targetSets) return false;
    }
  }

  return anyTargetDefined;
}
