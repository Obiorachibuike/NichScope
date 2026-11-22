"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";

const axisStyle = {
  fontSize: 10,
  fill: "var(--muted)",
} as const;

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--foreground)",
  padding: "8px 10px",
};

export function OpportunityBars({
  data,
  height = 280,
}: {
  data: { name: string; score: number }[];
  height?: number;
}) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={axisStyle}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--card-elevated)" }} />
        <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={16} name="Opportunity score">
          {data.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={index === 0 ? "var(--primary)" : "var(--secondary)"}
              fillOpacity={index === 0 ? 1 : 0.55}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GrowthTrendChart({
  data,
  height = 260,
}: {
  data: { period: string; growth: number | null; opportunity: number | null }[];
  height?: number;
}) {
  const hasData = data.some((d) => d.growth !== null || d.opportunity !== null);
  if (!hasData) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -12, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="opportunityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="period" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="growth"
          name="View growth %"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#growthFill)"
          connectNulls
        />
        <Area
          type="monotone"
          dataKey="opportunity"
          name="Opportunity score"
          stroke="var(--chart-2)"
          strokeWidth={2}
          fill="url(#opportunityFill)"
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MetricRadar({
  data,
  height = 260,
}: {
  data: { metric: string; value: number }[];
  height?: number;
}) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--chart-grid)" />
        <PolarAngleAxis dataKey="metric" tick={axisStyle} />
        <Radar
          name="Score"
          dataKey="value"
          stroke="var(--chart-1)"
          fill="var(--chart-1)"
          fillOpacity={0.22}
        />
        <Tooltip contentStyle={tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function ViewsBarChart({
  data,
  height = 240,
}: {
  data: { label: string; views: number }[];
  height?: number;
}) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={54} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatNumber(value)} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [formatNumber(Number(value)), "Average views"]}
        />
        <Bar dataKey="views" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}
