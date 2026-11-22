import { describe, expect, it } from "vitest";
import type { DataPermission, DataSource } from "@/lib/db/schema";
import { evaluateSourceUse, type GovernanceSnapshot } from "./compliance";

type Options = { demo: boolean; licensedEnabled: boolean; youtubeApproved: boolean };

function source(overrides: Partial<DataSource>): DataSource {
  return {
    id: "src-1",
    key: "youtube_data_api",
    name: "YouTube Data API v3",
    type: "youtube_api",
    description: null,
    termsUrl: null,
    status: "active",
    permitsCrossChannelAggregation: false,
    permitsDerivedMetrics: false,
    permitsHistoricalTracking: false,
    permitsCommercialDisplay: false,
    retentionDays: 30,
    lastVerifiedAt: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DataSource;
}

function permission(overrides: Partial<DataPermission>): DataPermission {
  return {
    id: "perm-1",
    dataSourceId: "src-1",
    scope: "ranking",
    status: "approved",
    approvalRef: "YT-APPROVAL-2026-001",
    approvedBy: "admin",
    approvedAt: new Date(),
    expiresAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as DataPermission;
}

const defaultOptions: Options = {
  demo: false,
  licensedEnabled: false,
  youtubeApproved: false,
};

function snapshot(sources: DataSource[], permissions: DataPermission[] = []): GovernanceSnapshot {
  return { sources, permissions };
}

describe("compliance: YouTube API", () => {
  const youtube = source({});

  it("allows individual channel/video research with attribution", () => {
    const result = evaluateSourceUse(youtube, snapshot([youtube]), "individual_research", defaultOptions);
    expect(result.allowed).toBe(true);
    expect(result.requiresAttribution).toBe(true);
    expect(result.reason).toMatch(/attribution/i);
  });

  it.each([
    "ranking",
    "opportunity_scoring",
    "cross_channel_aggregation",
    "derived_metrics",
    "historical_tracking",
    "commercial_display",
  ] as const)("denies %s without written approval", (use) => {
    const result = evaluateSourceUse(youtube, snapshot([youtube]), use, defaultOptions);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/approval/i);
  });

  it("still denies aggregation when an admin recorded a permission but the deployment flag is not approved", () => {
    const result = evaluateSourceUse(
      youtube,
      snapshot([youtube], [permission({})]),
      "ranking",
      { ...defaultOptions, youtubeApproved: false },
    );
    expect(result.allowed).toBe(false);
  });

  it("still denies aggregation when the flag is approved but no permission row exists", () => {
    const result = evaluateSourceUse(youtube, snapshot([youtube]), "ranking", {
      ...defaultOptions,
      youtubeApproved: true,
    });
    expect(result.allowed).toBe(false);
  });

  it("allows ranking only when both the flag and a scoped permission are present", () => {
    const result = evaluateSourceUse(
      youtube,
      snapshot([youtube], [permission({})]),
      "ranking",
      { ...defaultOptions, youtubeApproved: true },
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/approval/i);
  });

  it("treats expired permissions as not approved", () => {
    const result = evaluateSourceUse(
      youtube,
      snapshot([youtube], [permission({ expiresAt: new Date(Date.now() - 86_400_000) })]),
      "ranking",
      { ...defaultOptions, youtubeApproved: true },
    );
    expect(result.allowed).toBe(false);
  });

  it("denies everything when the source is disabled", () => {
    const disabled = source({ status: "disabled" });
    for (const use of ["public_display", "individual_research", "ranking"] as const) {
      expect(evaluateSourceUse(disabled, snapshot([disabled]), use, { ...defaultOptions, youtubeApproved: true }).allowed).toBe(false);
    }
  });
});

describe("compliance: licensed analytics", () => {
  const licensed = source({
    id: "src-2",
    key: "licensed_analytics",
    name: "Licensed analytics provider",
    type: "licensed_analytics",
    status: "active",
  });

  it("denies use while the deployment flag is off, even with approved scopes", () => {
    const result = evaluateSourceUse(
      licensed,
      snapshot([licensed], [permission({ dataSourceId: "src-2", scope: "commercial_display" })]),
      "commercial_display",
      defaultOptions,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/LICENSED_DATA_PROVIDER_ENABLED/);
  });

  it("requires a commercial display scope before ranking licensed data", () => {
    const noCommercial = evaluateSourceUse(
      licensed,
      snapshot([licensed], [permission({ dataSourceId: "src-2", scope: "ranking" })]),
      "ranking",
      { ...defaultOptions, licensedEnabled: true },
    );
    expect(noCommercial.allowed).toBe(false);
    expect(noCommercial.reason).toMatch(/Commercial display/i);

    const withCommercial = evaluateSourceUse(
      licensed,
      snapshot(
        [licensed],
        [
          permission({ id: "p1", dataSourceId: "src-2", scope: "ranking" }),
          permission({ id: "p2", dataSourceId: "src-2", scope: "commercial_display" }),
        ],
      ),
      "ranking",
      { ...defaultOptions, licensedEnabled: true },
    );
    expect(withCommercial.allowed).toBe(true);
  });

  it("keeps licensed data distinguishable from YouTube data", () => {
    const result = evaluateSourceUse(licensed, snapshot([licensed]), "ranking", {
      ...defaultOptions,
      licensedEnabled: true,
    });
    expect(result.requiresAttribution).toBe(false);
    expect(result.isFixture).toBe(false);
    expect(result.sourceKey).toBe("licensed_analytics");
  });
});

describe("compliance: fixtures and taxonomy", () => {
  const fixture = source({
    id: "src-3",
    key: "demo_fixture",
    name: "Demo fixtures",
    type: "demo_fixture",
    status: "active",
  });
  const taxonomy = source({
    id: "src-4",
    key: "internal_taxonomy",
    name: "NicheScope taxonomy",
    type: "internal_taxonomy",
    status: "active",
  });

  it("only serves fixtures when demo mode is enabled and labels them", () => {
    const off = evaluateSourceUse(fixture, snapshot([fixture]), "ranking", defaultOptions);
    expect(off.allowed).toBe(false);
    expect(off.reason).toMatch(/DEMO_MODE/);

    const on = evaluateSourceUse(fixture, snapshot([fixture]), "ranking", {
      ...defaultOptions,
      demo: true,
    });
    expect(on.allowed).toBe(true);
    expect(on.isFixture).toBe(true);
    expect(on.reason).toMatch(/demo fixture/i);
  });

  it("never allows taxonomy records to be ranked or scored", () => {
    expect(
      evaluateSourceUse(taxonomy, snapshot([taxonomy]), "ranking", defaultOptions).allowed,
    ).toBe(false);
    expect(
      evaluateSourceUse(taxonomy, snapshot([taxonomy]), "opportunity_scoring", defaultOptions).allowed,
    ).toBe(false);
    expect(
      evaluateSourceUse(taxonomy, snapshot([taxonomy]), "public_display", defaultOptions).allowed,
    ).toBe(true);
  });
});
