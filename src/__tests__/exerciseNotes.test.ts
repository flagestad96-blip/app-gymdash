// Mock DB before imports
const mockGetFirstSync = jest.fn((): any => null);
const mockGetAllSync = jest.fn((): any[] => []);
const mockRunAsync = jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 }));

jest.mock("../db", () => ({
  getDb: () => ({
    getFirstSync: mockGetFirstSync,
    getAllSync: mockGetAllSync,
    runAsync: mockRunAsync,
  }),
}));

import { getNote, getAllNotes, setNote, deleteNote } from "../exerciseNotes";

beforeEach(() => {
  mockGetFirstSync.mockReset().mockReturnValue(null);
  mockGetAllSync.mockReset().mockReturnValue([]);
  mockRunAsync.mockReset().mockResolvedValue({ changes: 0, lastInsertRowId: 0 });
});

describe("getNote", () => {
  it("returns note text when note exists", () => {
    mockGetFirstSync.mockReturnValue({ note: "Keep elbows tucked" });

    const result = getNote("bench_press");

    expect(result).toBe("Keep elbows tucked");
    expect(mockGetFirstSync).toHaveBeenCalledWith(
      expect.stringContaining("exercise_notes"),
      ["bench_press"]
    );
  });

  it("returns null when no note exists", () => {
    mockGetFirstSync.mockReturnValue(null);

    const result = getNote("squat");

    expect(result).toBeNull();
  });

  it("returns null when DB throws", () => {
    mockGetFirstSync.mockImplementation(() => {
      throw new Error("DB error");
    });

    const result = getNote("deadlift");

    expect(result).toBeNull();
  });
});

describe("setNote", () => {
  it("calls runAsync with INSERT OR REPLACE", async () => {
    await setNote("bench_press", "Focus on arch");

    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    const call = mockRunAsync.mock.calls[0] as any[];
    expect(call[0]).toContain("INSERT OR REPLACE");
    expect(call[0]).toContain("exercise_notes");
    expect(call[1][0]).toBe("bench_press");
    expect(call[1][1]).toBe("Focus on arch");
  });
});

describe("deleteNote", () => {
  it("calls runAsync with DELETE", async () => {
    await deleteNote("bench_press");

    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    const call = mockRunAsync.mock.calls[0] as any[];
    expect(call[0]).toContain("DELETE FROM exercise_notes");
    expect(call[1][0]).toBe("bench_press");
  });

  it("results in getNote returning null after delete", async () => {
    // First: note exists
    mockGetFirstSync.mockReturnValue({ note: "Old note" });
    expect(getNote("bench_press")).toBe("Old note");

    // Delete
    await deleteNote("bench_press");

    // After delete: simulate note gone
    mockGetFirstSync.mockReturnValue(null);
    expect(getNote("bench_press")).toBeNull();
  });
});

describe("getAllNotes", () => {
  it("returns a Record mapping exercise IDs to notes", () => {
    mockGetAllSync.mockReturnValue([
      { exercise_id: "bench_press", note: "Arch back" },
      { exercise_id: "squat", note: "Break at hips" },
      { exercise_id: "deadlift", note: "Brace core" },
    ]);

    const result = getAllNotes();

    expect(result).toEqual({
      bench_press: "Arch back",
      squat: "Break at hips",
      deadlift: "Brace core",
    });
  });

  it("returns empty object when no notes exist", () => {
    mockGetAllSync.mockReturnValue([]);

    const result = getAllNotes();

    expect(result).toEqual({});
  });

  it("returns empty object when DB throws", () => {
    mockGetAllSync.mockImplementation(() => {
      throw new Error("DB error");
    });

    const result = getAllNotes();

    expect(result).toEqual({});
  });
});
