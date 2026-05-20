import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import type { PredictResponse } from "../api";

const COLORS = ["#22d3ee", "#a78bfa", "#facc15", "#ff4b4b"];

export default function ModelComparison({ prediction }: { prediction: PredictResponse | null }) {
  const data = prediction
    ? [
        ...prediction.per_model.map((m) => ({ name: m.model, mins: m.duration_minutes })),
        { name: "Ensemble", mins: prediction.ensemble_minutes },
      ]
    : [
        { name: "LightGBM", mins: 0 },
        { name: "XGBoost", mins: 0 },
        { name: "CatBoost", mins: 0 },
        { name: "Ensemble", mins: 0 },
      ];

  return (
    <div className="glass gradient-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">Model breakdown</h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">minutes</span>
      </div>
      <div className="h-44">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "#1d2643" }} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "#1d2643" }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#10162b", border: "1px solid #1d2643", borderRadius: 8, color: "#e5e7eb", fontSize: 12 }}
              cursor={{ fill: "rgba(34,211,238,0.08)" }}
            />
            <Bar dataKey="mins" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
