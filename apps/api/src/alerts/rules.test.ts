import { describe, expect, it } from "vitest";
import { inCooldown, matchesTemp } from "#alerts/rules";

describe("matchesTemp", () => {
  it("handles above/below", () => {
    expect(matchesTemp({ kind: "temp_above", threshold: 30 }, 31)).toBe(true);
    expect(matchesTemp({ kind: "temp_above", threshold: 30 }, 30)).toBe(false);
    expect(matchesTemp({ kind: "temp_below", threshold: 5 }, 4)).toBe(true);
    expect(matchesTemp({ kind: "temp_above", threshold: null }, 99)).toBe(false);
  });
});

describe("inCooldown", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("is false when never triggered", () => {
    expect(inCooldown({ cooldownMin: 30, lastTriggeredAt: null }, now)).toBe(false);
  });
  it("is true within the window and false after", () => {
    expect(inCooldown({ cooldownMin: 30, lastTriggeredAt: new Date("2026-01-01T11:45:00Z") }, now)).toBe(true);
    expect(inCooldown({ cooldownMin: 30, lastTriggeredAt: new Date("2026-01-01T11:00:00Z") }, now)).toBe(false);
  });
});
