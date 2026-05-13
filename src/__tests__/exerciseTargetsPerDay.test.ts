import fs from "fs";
import path from "path";

// Locks in that exercise_targets supports a different target per (program,
// exercise, day) — required for the user-feedback feature «forskjellig
// reprange på samme øvelse når de faller på forskjellige dager».
describe("exercise_targets per-day support", () => {
  const dbSource = fs.readFileSync(path.join(__dirname, "..", "db.ts"), "utf8");

  it("schema includes day_index column with default 0", () => {
    expect(dbSource).toMatch(/exercise_targets[\s\S]*day_index INTEGER NOT NULL DEFAULT 0/);
  });

  it("schema enforces unique target per program/exercise/day", () => {
    // Migration 25 added the unique index keyed on day_index.
    expect(dbSource).toMatch(/UNIQUE.*program_id.*exercise_id.*day_index/i);
  });

  it("upsertTarget uses day-aware ON CONFLICT", () => {
    const store = fs.readFileSync(
      path.join(__dirname, "..", "progressionStore.ts"),
      "utf8",
    );
    expect(store).toMatch(/ON CONFLICT\(program_id, exercise_id, day_index\)/);
  });
});
