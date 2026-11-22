import { describe, expect, it } from "vitest";
import { estimateCost, extractJson } from "./providers";
import { videoIdeasSchema, SCHEMA_BY_TYPE } from "./types";

describe("extractJson", () => {
  it("returns a plain JSON object unchanged", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("unwraps fenced JSON blocks", () => {
    expect(extractJson('```json\n{"a":1,"b":[2]}\n```')).toBe('{"a":1,"b":[2]}');
    expect(extractJson('```\n{"x":true}\n```')).toBe('{"x":true}');
  });

  it("strips commentary that models sometimes add around JSON", () => {
    expect(extractJson('Here is the report:\n{"a":1}\nHope this helps!')).toBe('{"a":1}');
  });

  it("throws when no JSON object exists", () => {
    expect(() => extractJson("No data available.")).toThrow(/did not contain a JSON object/);
    expect(() => extractJson('{"broken": ')).toThrow();
  });
});

describe("estimateCost", () => {
  it("computes cost from per-million token pricing", () => {
    // gpt-4o-mini: $0.15 input / $0.60 output per 1M tokens.
    expect(estimateCost("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75, 6);
    expect(estimateCost("gpt-4o-mini", 100_000, 50_000)).toBeCloseTo(0.045, 6);
  });

  it("returns zero for unknown or unpriced providers", () => {
    expect(estimateCost("unknown-model", 10_000, 10_000)).toBe(0);
    expect(estimateCost("agnes-1", 10_000, 10_000)).toBe(0);
  });
});

describe("AI report schemas", () => {
  it("rejects invented report types", () => {
    expect(Object.keys(SCHEMA_BY_TYPE)).toEqual(
      expect.arrayContaining([
        "niche_analysis",
        "research_report",
        "subniches",
        "video_ideas",
        "competition",
        "channel_strategy",
      ]),
    );
  });

  it("validates video ideas and their format enum", () => {
    const valid = {
      ideas: [
        {
          title: "Test idea",
          hook: "A concrete hook",
          format: "short",
          rationale: "Because the evidence shows demand",
          difficulty: "low",
        },
      ],
      notes: ["Keep claims tied to evidence"],
    };
    expect(videoIdeasSchema.safeParse(valid).success).toBe(true);
    expect(
      videoIdeasSchema.safeParse({
        ...valid,
        ideas: [{ ...valid.ideas[0], format: "shorts" }],
      }).success,
    ).toBe(false);
    expect(videoIdeasSchema.safeParse({ ideas: [], notes: [] }).success).toBe(false);
  });
});
