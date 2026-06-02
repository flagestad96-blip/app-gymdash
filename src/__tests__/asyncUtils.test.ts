import { withTimeout } from "../asyncUtils";

describe("withTimeout", () => {
  it("resolves with the value when the promise settles in time", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, "fast");
    expect(result).toBe(42);
  });

  it("resolves to null when the promise is slower than the timeout", async () => {
    const slow = new Promise<number>((resolve) => setTimeout(() => resolve(1), 50));
    const result = await withTimeout(slow, 5, "slow");
    expect(result).toBeNull();
  });

  it("resolves to null when the promise rejects", async () => {
    const result = await withTimeout(Promise.reject(new Error("boom")), 1000, "rejects");
    expect(result).toBeNull();
  });
});
