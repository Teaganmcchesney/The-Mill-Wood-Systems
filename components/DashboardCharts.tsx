"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProductionLine } from "@/lib/types";

type JoinedLine = { name: string } | { name: string }[] | null;

type Completion = {
  wall_type: string;
  lineal_feet: number;
  production_line_id: string;
  completed_at: string;
  production_lines: JoinedLine;
};

type WallSummary = {
  wall_type: string;
  lineal_feet: number;
  status: string;
  production_lines: JoinedLine;
};

export function DashboardCharts({
  completions,
  walls,
  lines
}: {
  completions: Completion[];
  walls: WallSummary[];
  lines: ProductionLine[];
}) {
  const today = new Date().toDateString();
  const todayFeet = completions
    .filter((item) => new Date(item.completed_at).toDateString() === today)
    .reduce((sum, item) => sum + Number(item.lineal_feet), 0);
  const weekFeet = completions.reduce((sum, item) => sum + Number(item.lineal_feet), 0);
  const remainingFeet = walls.filter((wall) => wall.status !== "complete").reduce((sum, wall) => sum + Number(wall.lineal_feet), 0);
  const byType = groupBy(completions, (item) => item.wall_type);
  const byLine = groupBy(completions, (item) => lineName(item.production_lines));
  const remainingByLine = groupBy(
    walls.filter((wall) => wall.status !== "complete"),
    (item) => lineName(item.production_lines)
  );

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-lg font-bold text-steel">Production dashboard</p>
        <h1 className="text-4xl font-black text-ink">Lineal feet completed and remaining</h1>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Kpi label="Completed today" value={`${todayFeet.toFixed(1)} LF`} tone="bg-pass text-white" />
        <Kpi label="Completed this week" value={`${weekFeet.toFixed(1)} LF`} tone="bg-ink text-white" />
        <Kpi label="Remaining" value={`${remainingFeet.toFixed(1)} LF`} tone="bg-shop text-ink" />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <ChartPanel title="Completed by wall type" data={byType} />
        <ChartPanel title="Completed by production line" data={byLine} />
        <ChartPanel title="Remaining by production line" data={remainingByLine} />
        <section className="rounded-md bg-white p-5 shadow-touch">
          <h2 className="text-2xl font-black text-ink">Lines</h2>
          <div className="mt-4 grid gap-3">
            {lines.map((line) => {
              const lineDone = completions.filter((item) => item.production_line_id === line.id).reduce((sum, item) => sum + Number(item.lineal_feet), 0);
              return (
                <div key={line.id} className="flex items-center justify-between rounded-md bg-slate-100 p-4">
                  <span className="text-xl font-black text-ink">{line.name}</span>
                  <span className="text-xl font-black text-pass">{lineDone.toFixed(1)} LF</span>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-md p-6 shadow-touch ${tone}`}>
      <p className="text-lg font-black opacity-80">{label}</p>
      <p className="mt-2 text-5xl font-black">{value}</p>
    </div>
  );
}

function ChartPanel({ title, data }: { title: string; data: { name: string; linealFeet: number }[] }) {
  return (
    <section className="rounded-md bg-white p-5 shadow-touch">
      <h2 className="text-2xl font-black text-ink">{title}</h2>
      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 14, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 14, fontWeight: 700 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="linealFeet" name="Lineal feet" fill="#2f855a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function groupBy<T>(items: T[], getName: (item: T) => string) {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const key = getName(item);
    map.set(key, (map.get(key) ?? 0) + Number((item as { lineal_feet: number }).lineal_feet));
  });
  return Array.from(map, ([name, linealFeet]) => ({ name, linealFeet }));
}

function lineName(line: JoinedLine) {
  if (!line) return "Unassigned";
  return Array.isArray(line) ? line[0]?.name ?? "Unassigned" : line.name;
}
