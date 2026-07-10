"use client";

import { useState } from "react";
import { Save, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase-browser";
import type { ProductionLine } from "@/lib/types";

type JoinedLine = { name: string } | { name: string }[] | null;
type JoinedProject = { name: string; code: string } | { name: string; code: string }[] | null;

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
  projects: JoinedProject;
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
  const projectSummaries = summarizeProjects(walls);

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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projectSummaries.map((project) => (
          <ProjectBox key={project.key} project={project} />
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <ChartPanel title="Completed by wall type" data={byType} />
        <ChartPanel title="Completed by production line" data={byLine} />
        <ChartPanel title="Remaining by production line" data={remainingByLine} />
        <LineStaffing lines={lines} completions={completions} />
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

function ProjectBox({ project }: { project: ProjectSummary }) {
  const percent = project.totalFeet > 0 ? Math.round((project.completedFeet / project.totalFeet) * 100) : 0;

  return (
    <section className="rounded-md bg-white p-5 shadow-touch">
      <p className="text-lg font-bold text-steel">{project.code}</p>
      <h2 className="text-3xl font-black text-ink">{project.name}</h2>
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-pass" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <SmallMetric label="Done" value={`${project.completedFeet.toFixed(1)} LF`} />
        <SmallMetric label="Left" value={`${project.remainingFeet.toFixed(1)} LF`} />
        <SmallMetric label="Walls" value={`${project.completedWalls}/${project.totalWalls}`} />
      </div>
    </section>
  );
}

function LineStaffing({ lines, completions }: { lines: ProductionLine[]; completions: Completion[] }) {
  const [crewCounts, setCrewCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((line) => [line.id, String(line.crew_count ?? 0)]))
  );
  const [savingLineId, setSavingLineId] = useState("");
  const [message, setMessage] = useState("");

  async function saveCrewCount(lineId: string) {
    setSavingLineId(lineId);
    setMessage("");
    const supabase = createClient();
    const count = Math.max(0, Number.parseInt(crewCounts[lineId] || "0", 10) || 0);
    const { error } = await supabase.from("production_lines").update({ crew_count: count }).eq("id", lineId);
    setSavingLineId("");
    setMessage(error ? error.message : "Employee count saved.");
  }

  return (
    <section className="rounded-md bg-white p-5 shadow-touch">
      <div className="flex items-center gap-3">
        <Users size={28} className="text-ink" />
        <h2 className="text-2xl font-black text-ink">Line staffing</h2>
      </div>
      <div className="mt-4 grid gap-3">
        {lines.map((line) => {
          const lineDone = completions.filter((item) => item.production_line_id === line.id).reduce((sum, item) => sum + Number(item.lineal_feet), 0);
          const count = Math.max(0, Number.parseInt(crewCounts[line.id] || "0", 10) || 0);
          const feetPerEmployee = count > 0 ? lineDone / count : 0;

          return (
            <div key={line.id} className="grid gap-3 rounded-md bg-slate-100 p-4 md:grid-cols-[1fr_9rem_auto] md:items-center">
              <div>
                <p className="text-xl font-black text-ink">{line.name}</p>
                <p className="text-base font-bold text-steel">{lineDone.toFixed(1)} LF this week / {feetPerEmployee.toFixed(1)} LF per employee</p>
              </div>
              <input
                className="touch-target w-full rounded-md border border-slate-300 px-4 text-2xl font-black text-ink"
                type="number"
                min="0"
                inputMode="numeric"
                value={crewCounts[line.id] ?? "0"}
                onChange={(event) => setCrewCounts({ ...crewCounts, [line.id]: event.target.value })}
                aria-label={`${line.name} employee count`}
              />
              <button
                onClick={() => saveCrewCount(line.id)}
                className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 text-lg font-black text-white"
              >
                <Save size={22} /> {savingLineId === line.id ? "Saving" : "Save"}
              </button>
            </div>
          );
        })}
      </div>
      {message ? <p className="mt-3 rounded-md bg-slate-100 p-3 text-lg font-bold text-steel">{message}</p> : null}
    </section>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-100 p-3">
      <p className="text-xs font-bold uppercase text-steel">{label}</p>
      <p className="text-xl font-black text-ink">{value}</p>
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

type ProjectSummary = {
  key: string;
  code: string;
  name: string;
  totalFeet: number;
  completedFeet: number;
  remainingFeet: number;
  totalWalls: number;
  completedWalls: number;
};

function summarizeProjects(walls: WallSummary[]) {
  const map = new Map<string, ProjectSummary>();

  walls.forEach((wall) => {
    const project = projectName(wall.projects);
    const current = map.get(project.key) ?? {
      key: project.key,
      code: project.code,
      name: project.name,
      totalFeet: 0,
      completedFeet: 0,
      remainingFeet: 0,
      totalWalls: 0,
      completedWalls: 0
    };

    const feet = Number(wall.lineal_feet);
    current.totalFeet += feet;
    current.totalWalls += 1;
    if (wall.status === "complete") {
      current.completedFeet += feet;
      current.completedWalls += 1;
    } else {
      current.remainingFeet += feet;
    }
    map.set(project.key, current);
  });

  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
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

function projectName(project: JoinedProject) {
  const value = Array.isArray(project) ? project[0] ?? null : project;
  return {
    key: value?.code ?? "unassigned",
    code: value?.code ?? "No project",
    name: value?.name ?? "Unassigned walls"
  };
}
