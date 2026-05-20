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

      {prediction.intervals.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">
            Conformal prediction interval
          </div>
          <IntervalBar prediction={prediction} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {prediction.intervals.map((iv) => (
              <span
                key={iv.level}
                className="text-[10px] px-2 py-1 rounded-md bg-ink-700/70 border border-white/5 font-mono"
              >
                <span className="text-cyan-300 font-semibold">{Math.round(iv.level * 100)}%</span>
                <span className="text-slate-300"> [{iv.lower_minutes.toFixed(1)}, {iv.upper_minutes.toFixed(1)}]</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IntervalBar({ prediction }: { prediction: PredictResponse }) {
  const iv95 = prediction.intervals.find((i) => i.level === 0.95) ?? prediction.intervals[prediction.intervals.length - 1];
  const iv90 = prediction.intervals.find((i) => i.level === 0.9);
  const iv50 = prediction.intervals.find((i) => i.level === 0.5);
  if (!iv95) return null;
  const min = iv95.lower_minutes;
  const max = iv95.upper_minutes;
  const span = max - min || 1;
  const pct = (v: number) => ((v - min) / span) * 100;
  const ens = prediction.ensemble_minutes;
  return (
    <div className="relative h-7">
      <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-ink-700" />
      {iv90 && (
        <div
          className="absolute top-2.5 h-2 rounded-full bg-cyan-500/40"
          style={{ left: `${pct(iv90.lower_minutes)}%`, width: `${pct(iv90.upper_minutes) - pct(iv90.lower_minutes)}%` }}
        />
      )}
      {iv50 && (
        <div
          className="absolute top-2 h-3 rounded-full bg-cyan-400/70"
          style={{ left: `${pct(iv50.lower_minutes)}%`, width: `${pct(iv50.upper_minutes) - pct(iv50.lower_minutes)}%` }}
        />
      )}
      <div
        className="absolute top-1 h-5 w-1 rounded bg-white"
        style={{ left: `calc(${pct(ens)}% - 2px)` }}
      />
      <div className="absolute -bottom-1 left-0 text-[9px] text-slate-500 font-mono">{min.toFixed(0)}</div>
      <div className="absolute -bottom-1 right-0 text-[9px] text-slate-500 font-mono">{max.toFixed(0)}</div>
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
