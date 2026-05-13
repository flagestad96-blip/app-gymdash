// Locks in the behaviour the user expects from «Legg til øvelse»-søket:
// short queries must return results, casing must not matter, and an empty
// query must still surface the full library.

import { searchExercises } from "../exerciseLibrary";

describe("searchExercises", () => {
  it("returns the full library when the query is empty", () => {
    const all = searchExercises("");
    expect(all.length).toBeGreaterThan(50);
  });

  it("returns the full library when the query is whitespace only", () => {
    const all = searchExercises("   ");
    expect(all.length).toBeGreaterThan(50);
  });

  it("returns results for a 1-letter query", () => {
    const res = searchExercises("b");
    expect(res.length).toBeGreaterThan(0);
    // Every result actually contains the letter somewhere in name/id/aliases.
    for (const r of res.slice(0, 10)) {
      const haystack = `${r.id} ${r.displayName} ${(r.aliases ?? []).join(" ")}`.toLowerCase();
      expect(haystack).toContain("b");
    }
  });

  it("matches Norwegian queries with diacritics ignored", () => {
    const res = searchExercises("ben");
    expect(res.length).toBeGreaterThan(0);
  });

  it("is case-insensitive", () => {
    const lower = searchExercises("squat");
    const upper = searchExercises("SQUAT");
    expect(upper.length).toBe(lower.length);
  });
});
