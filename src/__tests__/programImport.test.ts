import { validateImport } from "../programImport";

const validProgram = {
  name: "PPL",
  days: [
    { name: "Push", blocks: [{ type: "single", exId: "bench" }] },
    { name: "Pull", blocks: [{ type: "superset", a: "row", b: "curl" }] },
  ],
};

describe("validateImport", () => {
  it("accepts a well-formed program", () => {
    const res = validateImport(validProgram);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.program.name).toBe("PPL");
  });

  it("accepts a three-way superset and the legacy `ex` key", () => {
    expect(validateImport({ name: "X", days: [{ name: "D", blocks: [{ type: "superset", a: "a", b: "b", c: "c" }] }] }).ok).toBe(true);
    expect(validateImport({ name: "X", days: [{ name: "D", blocks: [{ type: "single", ex: "legacy" }] }] }).ok).toBe(true);
  });

  it("rejects non-objects and missing name", () => {
    expect(validateImport(null)).toEqual({ ok: false, errorKey: "program.invalidJson" });
    expect(validateImport("nope")).toEqual({ ok: false, errorKey: "program.invalidJson" });
    expect(validateImport({ days: [] })).toEqual({ ok: false, errorKey: "program.mustHaveName" });
  });

  it("enforces 1..10 days", () => {
    expect(validateImport({ name: "X", days: [] })).toEqual({ ok: false, errorKey: "program.mustHave1to10Days" });
    const eleven = { name: "X", days: Array.from({ length: 11 }, () => ({ name: "D", blocks: [] })) };
    expect(validateImport(eleven)).toEqual({ ok: false, errorKey: "program.mustHave1to10Days" });
  });

  it("rejects malformed blocks", () => {
    expect(validateImport({ name: "X", days: [{ name: "D", blocks: [{ type: "single" }] }] })).toEqual({ ok: false, errorKey: "program.singleMissingExId" });
    expect(validateImport({ name: "X", days: [{ name: "D", blocks: [{ type: "superset", a: "a" }] }] })).toEqual({ ok: false, errorKey: "program.supersetMissingAB" });
    expect(validateImport({ name: "X", days: [{ name: "D", blocks: [{ type: "triset" }] }] })).toEqual({ ok: false, errorKey: "program.unknownBlockType" });
  });
});
