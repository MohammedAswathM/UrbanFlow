import { useEffect, useMemo, useState } from "react";
import MobilityMap from "./components/MobilityMap";
import PredictionPanel from "./components/PredictionPanel";
import ModelComparison from "./components/ModelComparison";
import FeatureImportance from "./components/FeatureImportance";
import ShapExplanation from "./components/ShapExplanation";
import ScenarioControls from "./components/ScenarioControls";
import { getGeoJson, getHeatmap, getZones, predict, type HeatCell, type PredictResponse, type Zone } from "./api";

function startOfWeekISO(targetWeekday: number, hour: number): string {
  // Build a naive local-timestamp string the backend can read directly,
  // bypassing the UTC conversion that toISOString() would do. The backend
  // only uses the hour/day/month components, so the timezone offset is
  // irrelevant - what matters is that the hour the user picked is the
  // hour the model sees.
  const d = new Date();
  const cur = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=Mon..6=Sun
  d.setDate(d.getDate() + (targetWeekday - cur));
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`;
}

export default function App() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [heat, setHeat] = useState<HeatCell[]>([]);

  const [pickupId, setPickupId] = useState<number>(161); // Midtown Center
  const [dropoffId, setDropoffId] = useState<number>(132); // JFK Airport
  const [hour, setHour] = useState<number>(18);
  const [weekday, setWeekday] = useState<number>(2);
  const [temperature, setTemperature] = useState<number>(65);
  const [isRainy, setIsRainy] = useState<boolean>(false);
  const [distance, setDistance] = useState<number>(8.5);

  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const [z, gj] = await Promise.all([getZones(), getGeoJson()]);
        setZones(z);
        setGeojson(gj);
      } catch (e: any) {
        setErr("Backend unreachable. Start it with: uvicorn main:app --reload --port 8000");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const h = await getHeatmap(hour, weekday >= 5);
        setHeat(h);
      } catch {}
    })();
  }, [hour, weekday]);

  const pickup = useMemo(() => zones.find((z) => z.id === pickupId) ?? null, [zones, pickupId]);
  const dropoff = useMemo(() => zones.find((z) => z.id === dropoffId) ?? null, [zones, dropoffId]);

  async function onPredict() {
    setLoading(true);
    setErr("");
    try {
      const out = await predict({
        pickup_location_id: pickupId,
        dropoff_location_id: dropoffId,
        trip_distance: distance,
        pickup_datetime: startOfWeekISO(weekday, hour),
        temperature,
        is_rainy: isRainy,
      });
      setPrediction(out);
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400 to-accent-500 grid place-items-center text-white font-extrabold shadow-glow">U</div>
          <div>
            <div className="text-lg font-extrabold tracking-tight">UrbanFlow</div>
            <div className="text-[11px] text-slate-400 -mt-0.5">NYC Mobility Intelligence · Ensemble Trip-Duration Forecasting</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs">
          <Stat label="Records" value="30.9 M" />
          <Stat label="Zones" value="263" />
          <Stat label="R²" value="0.864" />
          <Stat label="RMSE" value="3.98 min" />
        </div>
      </header>

      {err && (
        <div className="mx-6 mt-3 rounded-lg border border-accent-500/40 bg-accent-500/10 text-accent-400 px-3 py-2 text-sm">
          {err}
        </div>
      )}

      {/* Main grid */}
      <main className="flex-1 grid grid-cols-12 gap-4 p-4 lg:p-6">
        {/* Left: controls */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <ScenarioControls
            zones={zones}
            pickupId={pickupId}
            dropoffId={dropoffId}
            hour={hour}
            weekday={weekday}
            temperature={temperature}
            isRainy={isRainy}
            distance={distance}
            onChange={(n) => {
              if (n.pickupId !== undefined) setPickupId(n.pickupId);
              if (n.dropoffId !== undefined) setDropoffId(n.dropoffId);
              if (n.hour !== undefined) setHour(n.hour);
              if (n.weekday !== undefined) setWeekday(n.weekday);
              if (n.temperature !== undefined) setTemperature(n.temperature);
              if (n.isRainy !== undefined) setIsRainy(n.isRainy);
              if (n.distance !== undefined) setDistance(n.distance);
            }}
            onPredict={onPredict}
            loading={loading}
          />
          {prediction ? <ShapExplanation prediction={prediction} /> : <FeatureImportance />}
        </aside>

        {/* Center: map */}
        <section className="col-span-12 lg:col-span-6 min-h-[60vh] lg:min-h-[calc(100vh-7.5rem)]">
          <MobilityMap geojson={geojson} heat={heat} pickup={pickup} dropoff={dropoff} prediction={prediction} />
        </section>

        {/* Right: analytics */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <PredictionPanel prediction={prediction} loading={loading} />
          <ModelComparison prediction={prediction} />
          <div className="glass gradient-border rounded-2xl p-5 text-xs text-slate-300 leading-relaxed">
            <div className="text-sm font-semibold text-slate-100 mb-2">Why this is not Google Maps</div>
            UrbanFlow visualises a <span className="text-cyan-300 font-medium">fleet's expected occupancy time</span>,
            not a single user's route. Every taxi zone is shaded by its <span className="text-amber-300 font-medium">hour-conditioned demand pressure</span>,
            and the route arc is coloured by <span className="text-accent-400 font-medium">inter-model agreement</span> — a transparent confidence signal Google Maps does not expose.
          </div>
        </aside>
      </main>

      <footer className="px-6 py-3 border-t border-white/5 text-[11px] text-slate-500 flex items-center justify-between">
        <span>UrbanFlow · NYC TLC 2021 · NOAA NCEI · OpenStreetMap</span>
        <span>Built with FastAPI · React · Leaflet · Recharts</span>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-sm font-bold text-slate-100">{value}</div>
    </div>
  );
}
