import type { PredictResponse } from "../api";

export default function ShapExplanation({ prediction }: { prediction: PredictResponse | null }) {
  if (!prediction || prediction.shap.length === 0) {
    return (
      <div className="glass gradient-border rounded-2xl p-5 text-xs text-slate-400">
        Run a prediction to see the per-feature SHAP attribution that explains the ETA.
      </div>
    );
  }
  const max = Math.max(...prediction.shap.map((s) => Math.abs(s.contribution_minutes)), 1);
  return (
    <div className="glass gradient-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">Why this ETA</h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">SHAP · minutes</span>
      </div>
      <div className="text-[11px] text-slate-400 mb-3">
        Base&nbsp;<span className="text-slate-200 font-semibold">{prediction.shap_base_minutes.toFixed(1)} min</span>
        &nbsp;+&nbsp;contributions below&nbsp;=&nbsp;
        <span className="text-slate-200 font-semibold">{prediction.ensemble_minutes.toFixed(1)} min</span>
      </div>
      <div className="space-y-1.5">
        {prediction.shap.map((s) => {
          const pct = (Math.abs(s.contribution_minutes) / max) * 50;
          const pos = s.contribution_minutes >= 0;
          return (
            <div key={s.feature} className="flex items-center gap-2 text-xs">
              <div className="w-32 truncate font-mono text-slate-300">
                {s.feature}
                <span className="text-slate-500"> {String(s.value).slice(0, 14)}</span>
              </div>
              <div className="flex-1 flex items-center h-3">
                <div className="w-1/2 flex justify-end">
                  {!pos && (
                    <div
                      className="h-2 rounded-l-sm"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg,#22d3ee,#0ea5e9)" }}
                    />
                  )}
                </div>
                <div className="w-px h-3 bg-white/20" />
                <div className="w-1/2">
                  {pos && (
                    <div
                      className="h-2 rounded-r-sm"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg,#ff6b6b,#ff4b4b)" }}
                    />
                  )}
                </div>
              </div>
              <div
                className={`w-12 text-right font-semibold ${pos ? "text-accent-400" : "text-cyan-300"}`}
              >
                {pos ? "+" : ""}
                {s.contribution_minutes.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: "#22d3ee" }} /> shortens trip</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: "#ff4b4b" }} /> lengthens trip</span>
      </div>
    </div>
  );
}
