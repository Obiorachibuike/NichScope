import { describe, expect, it } from "vitest";
import {
  clamp,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  slugify,
  titleCase,
  truncate,
} from "./utils";

describe("formatNumber", () => {
  it("formats compact magnitudes and never invents a value", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1_500)).toBe("1.5K");
    expect(formatNumber(2_400_000)).toBe("2.4M");
    expect(formatNumber(3_100_000_000)).toBe("3.1B");
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(Number.NaN)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("adds a sign for positive values and handles missing data", () => {
    expect(formatPercent(12.34)).toBe("+12.3%");
    expect(formatPercent(-4)).toBe("-4.0%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("formats Shorts and long-form durations", () => {
    expect(formatDuration(59)).toBe("0:59");
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0)).toBe("—");
  });
});

describe("formatRelativeTime", () => {
  it("describes recent timestamps relatively", () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 30_000))).toBe("just now");
    expect(formatRelativeTime(new Date(now - 5 * 60_000))).toBe("5m ago");
    expect(formatRelativeTime(new Date(now - 3 * 3_600_000))).toBe("3h ago");
    expect(formatRelativeTime(new Date(now - 4 * 86_400_000))).toBe("4d ago");
    expect(formatRelativeTime(null)).toBe("—");
  });
});

describe("text helpers", () => {
  it("clamps numeric values", () => {
    expect(clamp(150)).toBe(100);
    expect(clamp(-3)).toBe(0);
    expect(clamp(42.5)).toBe(42.5);
    expect(clamp(5, 10, 20)).toBe(10);
  });

  it("creates stable slugs", () => {
    expect(slugify("AI Agents & Automation!")).toBe("ai-agents-automation");
    expect(slugify("  Faceless  Finance  ")).toBe("faceless-finance");
  });

  it("title-cases enum-like values", () => {
    expect(titleCase("fast_growing")).toBe("Fast Growing");
    expect(titleCase("long-form")).toBe("Long Form");
  });

  it("truncates long strings without cutting mid-word", () => {
    const out = truncate("Discover winning YouTube niches with evidence", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
    expect(truncate("short", 20)).toBe("short");
  });
});
