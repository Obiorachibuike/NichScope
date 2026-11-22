import { describe, expect, it } from "vitest";
import { filtersToQueryString, nicheFilterSchema, parseNicheFilters } from "./niches";

describe("niche filters", () => {
  it("applies safe defaults for missing or invalid input", () => {
    const filters = parseNicheFilters({});
    expect(filters.format).toBe("all");
    expect(filters.competition).toBe("all");
    expect(filters.growth).toBe("all");
    expect(filters.level).toBe("all");
    expect(filters.period).toBe("30d");
    expect(filters.sort).toBe("opportunity");
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(24);
    expect(filters.minOpportunity).toBe(0);
  });

  it("falls back instead of throwing on hostile values", () => {
    const filters = nicheFilterSchema.parse({
      page: "-9",
      pageSize: "9999",
      minOpportunity: "1000",
      sort: "drop table",
      format: "<script>",
      period: "all-time",
    });
    expect(filters.page).toBe(1);
    // Out-of-range values are rejected back to the documented default rather
    // than silently clamped to a different meaning.
    expect(filters.pageSize).toBe(24);
    expect(filters.minOpportunity).toBe(0);
    expect(filters.sort).toBe("opportunity");
    expect(filters.format).toBe("all");
    expect(filters.period).toBe("30d");
  });

  it("trims and drops empty strings", () => {
    const filters = parseNicheFilters({ q: "  ai agents  ", category: "", level: "sub" });
    expect(filters.q).toBe("ai agents");
    expect(filters.category).toBeUndefined();
    expect(filters.level).toBe("sub");
  });

  it("accepts multi-value query arrays by taking the first value", () => {
    const filters = parseNicheFilters({ category: ["finance", "technology"], page: ["2", "3"] });
    expect(filters.category).toBe("finance");
    expect(filters.page).toBe(2);
  });

  it("serialises filters back into a shareable query string, omitting defaults", () => {
    const query = filtersToQueryString({
      q: "ai",
      category: "technology",
      page: 1,
      sort: "opportunity",
      pageSize: 24,
    });
    expect(query).toContain("q=ai");
    expect(query).toContain("category=technology");
    expect(query).not.toContain("page=1");
  });
});
