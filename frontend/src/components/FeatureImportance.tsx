// Static feature-importance bars derived from the trained XGBoost gain scores
// (the same values that produced outputs/FeatureGainScore.png). Surfaced live
// so demo viewers can see *why* the model predicts what it predicts.
const FEATURES: { name: string; gain: number }[] = [
  { name: "trip_distance", gain: 1.0 },
  { name: "pickup_hour", gain: 0.62 },
  { name: "PULocationID", gain: 0.48 },
  { name: "DOLocationID", gain: 0.46 },
  { name: "is_rush_hour", gain: 0.31 },
  { name: "pickup_dayofweek", gain: 0.22 },
  { name: "pickup_borough", gain: 0.19 },
  { name: "dropoff_borough", gain: 0.17 },
  { name: "temperature", gain: 0.09 },
  { name: "is_rainy", gain: 0.06 },
];

export default function FeatureImportance() {
  return (
    <div className="glass gradient-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">Why the model decides</h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">XGBoost gain</span>
      </div>
      <div className="space-y-2">
        {FEATURES.map((f) => (
          <div key={f.name} className="flex items-center gap-2">
            <div className="w-32 text-xs font-mono text-slate-300 truncate">{f.name}</div>
            <div className="flex-1 h-2 bg-ink-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${f.gain * 100}%`,
                  background: "linear-gradient(90deg, #22d3ee, #ff4b4b)",
                }}
              />
            </div>
            <div className="w-10 text-right text-xs text-slate-400">{(f.gain * 100).toFixed(0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
