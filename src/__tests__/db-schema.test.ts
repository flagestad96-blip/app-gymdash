import fs from "fs";
import path from "path";

describe("db schema strings", () => {
  it("includes body_metrics table", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "db.ts"), "utf8");
    expect(content).toContain("body_metrics");
    expect(content).toContain("weight_kg");
  });

  it("includes bodyweight set columns", () => {
    const content = fs.readFileSync(path.join(__dirname, "..", "db.ts"), "utf8");
    expect(content).toContain("external_load_kg");
    expect(content).toContain("est_total_load_kg");
  });
});
