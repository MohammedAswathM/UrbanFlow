import type { Zone } from "../api";

type Props = {
  zones: Zone[];
  pickupId: number;
  dropoffId: number;
  hour: number;
  weekday: number;
  temperature: number;
  isRainy: boolean;
  distance: number;
  onChange: (next: Partial<{
    pickupId: number;
    dropoffId: number;
    hour: number;
    weekday: number;
    temperature: number;
    isRainy: boolean;
    distance: number;
  }>) => void;
  onPredict: () => void;
  loading: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScenarioControls(p: Props) {
  return (
    <div className="glass gradient-border rounded-2xl p-5 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Pickup zone</div>
        <ZoneSelect zones={p.zones} value={p.pickupId} onChange={(v) => p.onChange({ pickupId: v })} accent="#22d3ee" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Drop-off zone</div>
        <ZoneSelect zones={p.zones} value={p.dropoffId} onChange={(v) => p.onChange({ dropoffId: v })} accent="#ff4b4b" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Distance (mi)</Label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={p.distance}
            onChange={(e) => p.onChange({ distance: parseFloat(e.target.value || "0") })}
            className="w-full bg-ink-700 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-glow/50"
          />
        </div>
        <div>
          <Label>Temperature (°F)</Label>
          <input
            type="number"
            value={p.temperature}
            onChange={(e) => p.onChange({ temperature: parseFloat(e.target.value || "0") })}
            className="w-full bg-ink-700 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-glow/50"
          />
        </div>
      </div>

      <div>
        <Label>Hour of day: <span className="text-slate-200 font-semibold">{String(p.hour).padStart(2, "0")}:00</span></Label>
        <input
          type="range"
          min={0}
          max={23}
          value={p.hour}
          onChange={(e) => p.onChange({ hour: parseInt(e.target.value) })}
          className="w-full accent-cyan-400"
        />
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
        </div>
      </div>

      <div>
        <Label>Day of week</Label>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => p.onChange({ weekday: i })}
              className={`text-xs py-2 rounded-md border transition ${
                p.weekday === i
                  ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-100"
                  : "bg-ink-700/60 border-white/5 text-slate-300 hover:border-cyan-400/30"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label>Precipitation</Label>
        <button
          onClick={() => p.onChange({ isRainy: !p.isRainy })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${p.isRainy ? "bg-cyan-500/70" : "bg-ink-600"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${p.isRainy ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      <button
        onClick={p.onPredict}
        disabled={p.loading}
        className="w-full mt-1 py-3 rounded-xl font-semibold tracking-wide text-white
                   bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-accent-500
                   hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-glow"
      >
        {p.loading ? "Forecasting…" : "Predict Trip Duration"}
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">{children}</div>;
}

function ZoneSelect({ zones, value, onChange, accent }: { zones: Zone[]; value: number; onChange: (v: number) => void; accent: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full" style={{ background: accent }} />
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full bg-ink-700 border border-white/5 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-glow/40"
      >
        {zones.map((z) => (
          <option key={z.id} value={z.id} disabled={z.lat == null}>
            {z.zone} — {z.borough}
          </option>
        ))}
      </select>
    </div>
  );
}
