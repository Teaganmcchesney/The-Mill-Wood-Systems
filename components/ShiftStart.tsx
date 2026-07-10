"use client";

import Link from "next/link";
import { ArrowRight, Save, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { ProductionLine, ShiftManpower } from "@/lib/types";

export function ShiftStart({ lines, shiftManpower }: { lines: ProductionLine[]; shiftManpower: ShiftManpower[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [shiftName, setShiftName] = useState("Day");
  const [crewCounts, setCrewCounts] = useState<Record<string, string>>(() => valuesFor(lines, shiftManpower, today, "Day", "crew"));
  const [shiftHours, setShiftHours] = useState<Record<string, string>>(() => valuesFor(lines, shiftManpower, today, "Day", "hours"));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCrewCounts(valuesFor(lines, shiftManpower, today, shiftName, "crew"));
    setShiftHours(valuesFor(lines, shiftManpower, today, shiftName, "hours"));
  }, [lines, shiftManpower, shiftName, today]);

  async function saveAll() {
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const payload = lines.map((line) => ({
      production_line_id: line.id,
      shift_date: today,
      shift_name: shiftName,
      crew_count: Math.max(0, Number.parseInt(crewCounts[line.id] || "0", 10) || 0),
      shift_hours: Math.max(0, Number.parseFloat(shiftHours[line.id] || "0") || 0)
    }));

    const { error } = await supabase
      .from("shift_manpower")
      .upsert(payload, { onConflict: "production_line_id,shift_date,shift_name" });

    setSaving(false);
    setMessage(error ? error.message : "Shift manpower saved. You can start production.");
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <section className="rounded-md bg-white p-6 shadow-touch">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-md bg-ink text-white">
              <Users size={34} />
            </div>
            <div>
              <p className="text-lg font-bold text-steel">Start of shift</p>
              <h1 className="text-4xl font-black text-ink">Enter manpower first</h1>
            </div>
          </div>
          <select className="touch-target rounded-md border border-slate-300 px-5 text-2xl font-black text-ink" value={shiftName} onChange={(event) => setShiftName(event.target.value)}>
            <option value="Day">Day shift</option>
            <option value="Night">Night shift</option>
          </select>
        </div>
      </section>

      <section className="grid gap-4">
        {lines.map((line) => (
          <div key={line.id} className="grid gap-4 rounded-md bg-white p-5 shadow-touch md:grid-cols-[1fr_12rem_12rem] md:items-end">
            <div>
              <p className="text-lg font-bold text-steel">Production line</p>
              <h2 className="text-4xl font-black text-ink">{line.name}</h2>
            </div>
            <label className="grid gap-2 text-lg font-bold text-ink">
              Employees
              <input
                className="touch-target rounded-md border border-slate-300 px-4 text-3xl font-black"
                type="number"
                min="0"
                inputMode="numeric"
                value={crewCounts[line.id] ?? "0"}
                onChange={(event) => setCrewCounts({ ...crewCounts, [line.id]: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-lg font-bold text-ink">
              Shift hours
              <input
                className="touch-target rounded-md border border-slate-300 px-4 text-3xl font-black"
                type="number"
                min="0"
                step="0.5"
                inputMode="decimal"
                value={shiftHours[line.id] ?? "8"}
                onChange={(event) => setShiftHours({ ...shiftHours, [line.id]: event.target.value })}
              />
            </label>
          </div>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <button onClick={saveAll} className="touch-target inline-flex items-center justify-center gap-3 rounded-md bg-pass px-6 py-5 text-3xl font-black text-white">
          <Save size={34} /> {saving ? "Saving" : "Save manpower"}
        </button>
        <Link href="/shop" className="touch-target inline-flex items-center justify-center gap-3 rounded-md bg-ink px-6 py-5 text-2xl font-black text-white">
          Go to shop <ArrowRight size={30} />
        </Link>
      </section>
      {message ? <p className="rounded-md bg-white p-4 text-xl font-black text-ink shadow-touch">{message}</p> : null}
    </div>
  );
}

function valuesFor(lines: ProductionLine[], shifts: ShiftManpower[], date: string, shiftName: string, mode: "crew" | "hours") {
  return Object.fromEntries(
    lines.map((line) => {
      const shift = shifts.find((item) => item.production_line_id === line.id && item.shift_date === date && item.shift_name === shiftName);
      const value = mode === "crew" ? shift?.crew_count ?? line.crew_count ?? 0 : shift?.shift_hours ?? 8;
      return [line.id, String(value)];
    })
  );
}
