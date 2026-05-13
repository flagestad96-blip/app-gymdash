// Guard tests for the structural fixes in PR #2. These catch regressions
// where someone refactors the file and accidentally re-introduces the
// original bug (button buried under FlatList, edit modal not wired in,
// migration removed, etc.).
//
// Static source-level checks only — runtime UI behaviour still needs a
// device test.

import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..", "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("PR #2 fix guards", () => {
  describe("3-way superset picker layout", () => {
    const src = read("app/(tabs)/program.tsx");

    it("«Save as 2-way» button is rendered when in addSupersetC mode", () => {
      // The render block lives inside a `pickerMode === "addSupersetC" && ...` guard.
      expect(src).toMatch(/pickerMode === "addSupersetC" && pendingSupersetA && pendingSupersetB \?[\s\S]+?finishTwoWay/);
    });

    it("«Save as 2-way» action sits before the exercise FlatList (so it's not buried)", () => {
      const finishIdx = src.indexOf("finishTwoWay");
      const flatlistIdx = src.indexOf("data={filteredExercises}");
      expect(finishIdx).toBeGreaterThan(0);
      expect(flatlistIdx).toBeGreaterThan(0);
      // Regression bar: the action card must come first in the source so
      // it renders above the unbounded list.
      expect(finishIdx).toBeLessThan(flatlistIdx);
    });
  });

  describe("Historical workout edit/delete wiring", () => {
    it("EditSetModal exists and exposes the expected props", () => {
      const src = read("src/components/workout/EditSetModal.tsx");
      expect(src).toMatch(/visible: boolean/);
      expect(src).toMatch(/set: SetRow \| null/);
      expect(src).toMatch(/programId: string \| null/);
      expect(src).toMatch(/onClose:/);
      expect(src).toMatch(/onChanged:/);
      // Save + delete paths must hit the DB and (when possible) recompute PRs.
      expect(src).toMatch(/UPDATE sets SET/);
      expect(src).toMatch(/DELETE FROM sets WHERE id = \?/);
      expect(src).toMatch(/recomputePRForExercise/);
    });

    it("workout/[id].tsx wires EditSetModal and makes sets tappable", () => {
      const src = read("app/(tabs)/workout/[id].tsx");
      expect(src).toMatch(/import EditSetModal/);
      expect(src).toMatch(/<EditSetModal/);
      expect(src).toMatch(/onChanged=\{\(\) => \{ void load\(\); \}\}/);
    });

    it("calendar.tsx wires EditSetModal in the detail modal", () => {
      const src = read("app/(tabs)/calendar.tsx");
      expect(src).toMatch(/import EditSetModal/);
      expect(src).toMatch(/<EditSetModal/);
      expect(src).toMatch(/reloadDetailSets/);
      // Calendar set rows must be Pressable so they can open the modal.
      expect(src).toMatch(/onPress=\{\(\) => setEditingSet\(s\)\}/);
    });
  });

  describe("Legacy ended_at backfill (migration 27)", () => {
    const src = read("src/db.ts");

    it("migration 27 backfills ended_at from MAX(sets.created_at)", () => {
      expect(src).toMatch(/version: 27/);
      expect(src).toMatch(/UPDATE workouts\s+SET ended_at = \(\s+SELECT MAX\(s\.created_at\)/);
    });

    it("migration 27 skips the workout the user is currently resuming", () => {
      // Must not auto-close an in-flight workout during upgrade.
      expect(src).toMatch(/key = 'activeWorkoutId'/);
      expect(src).toMatch(/AND id NOT IN/);
    });
  });
});
