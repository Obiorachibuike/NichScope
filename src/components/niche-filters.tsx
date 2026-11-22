"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, RotateCcw, Save, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const COUNTRIES = [
  { code: "", label: "Any country" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "NG", label: "Nigeria" },
  { code: "IN", label: "India" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "BR", label: "Brazil" },
  { code: "JP", label: "Japan" },
  { code: "AU", label: "Australia" },
  { code: "ZA", label: "South Africa" },
];

const LANGUAGES = [
  { code: "", label: "Any language" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "id", label: "Indonesian" },
];

export interface FilterCategory {
  slug: string;
  name: string;
}

export function NicheFilters({
  categories,
  totalResults,
  statsAvailable,
}: {
  categories: FilterCategory[];
  totalResults: number;
  statsAvailable: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = useMemo(() => {
    const get = (key: string) => searchParams.get(key) ?? "";
    return {
      q: get("q"),
      category: get("category"),
      format: get("format") || "all",
      competition: get("competition") || "all",
      growth: get("growth") || "all",
      monetization: get("monetization") || "all",
      country: get("country"),
      language: get("language"),
      minOpportunity: get("minOpportunity") || "0",
      minAvgViews: get("minAvgViews") || "",
      sort: get("sort") || "opportunity",
      period: get("period") || "30d",
      dateFrom: get("dateFrom") || "",
      dateTo: get("dateTo") || "",
    };
  }, [searchParams]);

  useEffect(() => {
    // The URL is an external store (back/forward navigation or a shared link).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(current.q);
  }, [current.q]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const pushParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all" || value === "0") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q: value.trim() || null }), 350);
  };

  const activeCount = [
    current.q,
    current.category,
    current.format !== "all" ? current.format : "",
    current.competition !== "all" ? current.competition : "",
    current.growth !== "all" ? current.growth : "",
    current.monetization !== "all" ? current.monetization : "",
    current.country,
    current.language,
    current.minOpportunity !== "0" ? current.minOpportunity : "",
    current.minAvgViews,
    current.period !== "30d" ? current.period : "",
    current.dateFrom,
    current.dateTo,
  ].filter(Boolean).length;

  const clearAll = () => {
    setQuery("");
    router.replace(pathname, { scroll: false });
    setMobileOpen(false);
  };

  const saveSearch = async () => {
    if (saveName.trim().length < 2) {
      toast.error("Give your search a name of at least 2 characters");
      return;
    }
    setSaving(true);
    try {
      const queryObject: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        if (key !== "page") queryObject[key] = value;
      });
      const response = await fetch("/api/v1/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName.trim(), query: queryObject }),
      });
      const payload = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to save search");
      toast.success("Search saved — find it on the Saved page");
      setSaveOpen(false);
      setSaveName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save search");
    } finally {
      setSaving(false);
    }
  };

  const filterBody = (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="niche-search">Search</Label>
        <div className="relative">
          <Input
            id="niche-search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Niche, alias or keyword"
            className="pr-8"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted">Searches names, aliases and taxonomy keywords.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Category</Label>
          <Select
            value={current.category || "all"}
            onValueChange={(value) => pushParams({ category: value === "all" ? null : value })}
          >
            <SelectTrigger aria-label="Category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.slug} value={category.slug}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Video format</Label>
          <Select
            value={current.format}
            onValueChange={(value) => pushParams({ format: value })}
          >
            <SelectTrigger aria-label="Video format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All formats</SelectItem>
              <SelectItem value="shorts">YouTube Shorts</SelectItem>
              <SelectItem value="long_form">Long-form</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Competition</Label>
          <Select
            value={current.competition}
            onValueChange={(value) => pushParams({ competition: value })}
          >
            <SelectTrigger aria-label="Competition level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Growth</Label>
          <Select value={current.growth} onValueChange={(value) => pushParams({ growth: value })}>
            <SelectTrigger aria-label="Growth trend">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="fast_growing">Fast-growing</SelectItem>
              <SelectItem value="stable">Stable</SelectItem>
              <SelectItem value="declining">Declining</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Monetization</Label>
          <Select
            value={current.monetization}
            onValueChange={(value) => pushParams({ monetization: value })}
          >
            <SelectTrigger aria-label="Monetization potential">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select
            value={current.country || "all"}
            onValueChange={(value) => pushParams({ country: value === "all" ? null : value })}
          >
            <SelectTrigger aria-label="Country">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code || "all"} value={country.code || "all"}>
                  {country.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Language</Label>
          <Select
            value={current.language || "all"}
            onValueChange={(value) => pushParams({ language: value === "all" ? null : value })}
          >
            <SelectTrigger aria-label="Language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((language) => (
                <SelectItem key={language.code || "all"} value={language.code || "all"}>
                  {language.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Min opportunity</Label>
          <Select
            value={current.minOpportunity}
            onValueChange={(value) => pushParams({ minOpportunity: value })}
          >
            <SelectTrigger aria-label="Minimum opportunity score">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any score</SelectItem>
              <SelectItem value="40">40+</SelectItem>
              <SelectItem value="55">55+</SelectItem>
              <SelectItem value="70">70+</SelectItem>
              <SelectItem value="85">85+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Min avg views</Label>
          <Input
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            placeholder="e.g. 50000"
            defaultValue={current.minAvgViews}
            onChange={(event) => {
              const value = event.target.value;
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(
                () => pushParams({ minAvgViews: value || null }),
                500,
              );
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Ranking period</Label>
          <Select
            value={current.period}
            onValueChange={(value) => pushParams({ period: value })}
          >
            <SelectTrigger aria-label="Ranking period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {current.period === "custom" && (
          <>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input
                type="date"
                defaultValue={current.dateFrom}
                onChange={(event) => pushParams({ dateFrom: event.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                type="date"
                defaultValue={current.dateTo}
                onChange={(event) => pushParams({ dateTo: event.target.value || null })}
              />
            </div>
          </>
        )}

        <div className="col-span-2 space-y-1.5">
          <Label>Sort by</Label>
          <Select value={current.sort} onValueChange={(value) => pushParams({ sort: value })}>
            <SelectTrigger aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="opportunity">Highest opportunity</SelectItem>
              <SelectItem value="growth">Highest growth</SelectItem>
              <SelectItem value="competition">Lowest competition</SelectItem>
              <SelectItem value="avg_views">Highest average views</SelectItem>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="updated">Recently updated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!statsAvailable && (
        <p className="rounded-lg border border-warning/25 bg-warning/[0.05] px-3 py-2 text-[11px] leading-relaxed text-warning">
          No performance data source is eligible. Filters that depend on scores will
          return no results until a licensed provider is approved.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" size="sm" onClick={clearAll}>
          <RotateCcw className="size-3.5" /> Clear all
        </Button>
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Save className="size-3.5" /> Save search
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save this search</DialogTitle>
              <DialogDescription>
                Saved searches keep your filters and jump straight back to these
                results.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="saved-search-name">Name</Label>
              <Input
                id="saved-search-name"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="e.g. Low-competition AI niches"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="button" onClick={() => void saveSearch()} disabled={saving}>
                {saving ? "Saving…" : "Save search"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button type="button" variant="ghost" size="sm" onClick={() => setMobileOpen(false)} className="ml-auto lg:hidden">
          Show {totalResults.toLocaleString()} results
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:block">
        <div className="sticky top-24 rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="size-4 text-muted" /> Filters
            </div>
            {activeCount > 0 && (
              <Badge variant="default">{activeCount} active</Badge>
            )}
          </div>
          {filterBody}
        </div>
      </div>

      <div className="lg:hidden">
        <Button
          type="button"
          variant="secondary"
          className="w-full justify-between"
          onClick={() => setMobileOpen(true)}
        >
          <span className="flex items-center gap-2">
            <Filter className="size-4" /> Filters
          </span>
          <span className="text-xs text-muted">
            {activeCount} active · {totalResults.toLocaleString()} results
          </span>
        </Button>
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent className="max-h-[88dvh] w-[calc(100%-1rem)] max-w-md overflow-y-auto scrollbar-thin">
            <DialogHeader>
              <DialogTitle>Filter niches</DialogTitle>
              <DialogDescription>
                Filters update the URL so you can share and bookmark results.
              </DialogDescription>
            </DialogHeader>
            {filterBody}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
