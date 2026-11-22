"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function DashboardControls({
  category,
  period,
  limit,
}: {
  category: string;
  period: string;
  limit: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div className="space-y-1">
        <Label htmlFor="ranking-metric">Ranking metric</Label>
        <Select value={category} onValueChange={(value) => update("category", value)}>
          <SelectTrigger id="ranking-metric" aria-label="Ranking metric">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="opportunity">Highest opportunity</SelectItem>
            <SelectItem value="highest_growth">Highest growth</SelectItem>
            <SelectItem value="top_performing">Best performing</SelectItem>
            <SelectItem value="low_competition">Lowest competition</SelectItem>
            <SelectItem value="emerging">Emerging</SelectItem>
            <SelectItem value="declining">Declining</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ranking-period">Period</Label>
        <Select value={period} onValueChange={(value) => update("period", value)}>
          <SelectTrigger id="ranking-period" aria-label="Ranking period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="90d">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1 sm:col-span-1">
        <Label htmlFor="ranking-limit">Show</Label>
        <Select
          value={String(limit)}
          onValueChange={(value) => update("limit", value)}
        >
          <SelectTrigger id="ranking-limit" aria-label="Number of niches">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">Top 10</SelectItem>
            <SelectItem value="20">Top 20</SelectItem>
            <SelectItem value="50">Top 50</SelectItem>
            <SelectItem value="100">Top 100</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
