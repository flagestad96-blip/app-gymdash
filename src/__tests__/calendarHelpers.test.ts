// Mock the exercise library so classifyWorkout is deterministic and not coupled
// to real library ids/tags.
jest.mock("../exerciseLibrary", () => ({
  tagsFor: (id: string) => {
    const map: Record<string, string[]> = {
      push1: ["chest"],
      push2: ["shoulders"],
      push3: ["triceps"],
      pull1: ["back"],
      pull2: ["biceps"],
      pull3: ["forearms"],
      legs1: ["quads"],
      legs2: ["hamstrings"],
      legs3: ["glutes"],
    };
    return map[id] ?? [];
  },
}));

import { classifyWorkout, daysInMonth, startOfMonth, formatTime } from "../calendarHelpers";

describe("classifyWorkout", () => {
  it("returns other for no exercises / untagged", () => {
    expect(classifyWorkout([])).toBe("other");
    expect(classifyWorkout(["unknown"])).toBe("other");
  });

  it("classifies push / pull / legs sessions", () => {
    expect(classifyWorkout(["push1", "push2", "push3"])).toBe("push");
    expect(classifyWorkout(["pull1", "pull2", "pull3"])).toBe("pull");
    expect(classifyWorkout(["legs1", "legs2", "legs3"])).toBe("legs");
  });

  it("returns other for an evenly mixed session", () => {
    expect(classifyWorkout(["push1", "pull1", "legs1"])).toBe("other");
  });
});

describe("calendar date helpers", () => {
  it("daysInMonth handles 30/31/feb", () => {
    expect(daysInMonth(2026, 0)).toBe(31); // Jan
    expect(daysInMonth(2026, 1)).toBe(28); // Feb 2026 (non-leap)
    expect(daysInMonth(2024, 1)).toBe(29); // Feb 2024 (leap)
    expect(daysInMonth(2026, 3)).toBe(30); // Apr
  });

  it("startOfMonth returns the 1st", () => {
    const d = startOfMonth(2026, 5);
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(5);
  });

  it("formatTime returns HH:MM or empty", () => {
    expect(formatTime(null)).toBe("");
    expect(formatTime(undefined)).toBe("");
    expect(formatTime(new Date(2026, 5, 2, 9, 5).toISOString())).toMatch(/^\d{2}:\d{2}$/);
  });
});
