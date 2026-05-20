import type { PredictResponse } from "../api";

export default function PredictionPanel({ prediction, loading }: { prediction: PredictResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="glass gradient-border rounded-2xl p-5 animate-pulse">
        <div className="h-4 w-24 bg-ink-600 rounded mb-3" />
        <div className="h-10 w-40 bg-ink-600 rounded mb-4" />
        <div className="h-4 w-full bg-ink-600 rounded" />
      </div>
    );
  }
  if (!prediction) {
    return (
      <div className="glass gradient-border rounded-2xl p-5">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <span className="pulse-dot" /> Awaiting prediction
        </div>
        <p className="text-slate-300 mt-3 text-sm">
          Configure a trip on the left and tap <span className="font-semibold text-white">Predict</span>. The ensemble fuses LightGBM, XGBoost, and CatBoost outputs into a single ETA.
        </p>
      </div>
    );
  }

  return (
    <div className="glass gradient-border rounded-2xl p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">Ensemble ETA</div>
          <div className="text-5xl font-extrabold leading-tight">
            {prediction.ensemble_minutes.toFixed(1)}
            <span className="text-lg font-medium text-slate-400 ml-2">minutes</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-slate-400">Confidence</div>
          <div className="text-2xl font-bold text-teal-glow">{(prediction.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Pill label="Hour" value={String(prediction.context.pickup_hour).padStart(2, "0") + ":00"} />
        <Pill label="Rush" value={prediction.context.is_rush_hour ? "Yes" : "No"} />
        <Pill label="Weekend" value={prediction.context.is_weekend ? "Yes" : "No"} />
        <Pill label="Flow" value={`${prediction.context.pickup_borough} → ${prediction.context.dropoff_borough}`} />
      </div>
      <div className="mt-4 text-xs text-slate-400">
        Model spread <span className="text-slate-200 font-semibold">±{prediction.spread_minutes.toFixed(2)} min</span> across the three boosters.
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-700/70 px-3 py-2 border border-white/5">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-100 truncate">{value}</div>
    </div>
  );
}
