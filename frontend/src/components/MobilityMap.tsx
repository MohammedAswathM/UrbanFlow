import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { HeatCell, PredictResponse, Zone } from "../api";

type Props = {
  geojson: GeoJSON.FeatureCollection | null;
  heat: HeatCell[];
  pickup: Zone | null;
  dropoff: Zone | null;
  prediction: PredictResponse | null;
};

function pressureColor(p: number): string {
  // teal -> amber -> red
  if (p < 0.33) return "#22d3ee";
  if (p < 0.66) return "#facc15";
  return "#ff4b4b";
}

function FitBounds({ pickup, dropoff }: { pickup: Zone | null; dropoff: Zone | null }) {
  const map = useMap();
  useEffect(() => {
    if (pickup?.lat && pickup?.lng && dropoff?.lat && dropoff?.lng) {
      const b = L.latLngBounds([
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ]).pad(0.4);
      map.flyToBounds(b, { duration: 0.8 });
    }
  }, [pickup, dropoff, map]);
  return null;
}

export default function MobilityMap({ geojson, heat, pickup, dropoff, prediction }: Props) {
  const pressureById = useMemo(() => {
    const m = new Map<number, number>();
    heat.forEach((h) => m.set(h.id, h.pressure));
    return m;
  }, [heat]);

  const style = (feat?: GeoJSON.Feature) => {
    const id = feat?.properties?.LocationID as number | undefined;
    const p = id ? pressureById.get(id) ?? 0 : 0;
    return {
      color: "#1d2643",
      weight: 0.6,
      fillColor: pressureColor(p),
      fillOpacity: 0.15 + 0.5 * p,
    };
  };

  const routeArc = useMemo(() => {
    if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) return null;
    // Build a curved polyline by perturbing the midpoint along the perpendicular.
    const a: [number, number] = [pickup.lat, pickup.lng];
    const b: [number, number] = [dropoff.lat, dropoff.lng];
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const dx = b[1] - a[1];
    const dy = b[0] - a[0];
    const norm = Math.sqrt(dx * dx + dy * dy) || 1;
    const off = norm * 0.15;
    const ctrl: [number, number] = [mid[0] + (-dx / norm) * off, mid[1] + (dy / norm) * off];
    // Sample quadratic Bezier
    const pts: [number, number][] = [];
    for (let t = 0; t <= 1.0001; t += 0.04) {
      const lat = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * ctrl[0] + t * t * b[0];
      const lng = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * ctrl[1] + t * t * b[1];
      pts.push([lat, lng]);
    }
    return pts;
  }, [pickup, dropoff]);

  const routeColor = prediction
    ? prediction.confidence > 0.85
      ? "#22d3ee"
      : prediction.confidence > 0.6
      ? "#facc15"
      : "#ff4b4b"
    : "#22d3ee";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl gradient-border">
      <MapContainer
        center={[40.7589, -73.9851]}
        zoom={11}
        scrollWheelZoom={true}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geojson && (
          <GeoJSON
            key={heat.length === 0 ? "g0" : `g-${heat[0]?.id}-${heat.length}`}
            data={geojson}
            style={style as any}
            onEachFeature={(feat, layer) => {
              const props: any = feat.properties || {};
              const p = pressureById.get(props.LocationID) ?? 0;
              layer.bindTooltip(
                `<div style="font-family:Inter,sans-serif">
                   <div style="font-weight:700;color:#fff">${props.zone}</div>
                   <div style="color:#94a3b8;font-size:12px">${props.borough}</div>
                   <div style="margin-top:4px;color:${pressureColor(p)};font-weight:600">Demand: ${(p * 100).toFixed(0)}%</div>
                 </div>`,
                { sticky: true, opacity: 0.95 }
              );
            }}
          />
        )}

        {pickup?.lat && pickup?.lng && (
          <CircleMarker center={[pickup.lat, pickup.lng]} radius={10} pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 0.9, weight: 2 }}>
            <Popup>
              <b>Pickup</b>
              <br />
              {pickup.zone}
              <br />
              <span style={{ color: "#64748b" }}>{pickup.borough}</span>
            </Popup>
          </CircleMarker>
        )}
        {dropoff?.lat && dropoff?.lng && (
          <CircleMarker center={[dropoff.lat, dropoff.lng]} radius={10} pathOptions={{ color: "#ff4b4b", fillColor: "#ff4b4b", fillOpacity: 0.9, weight: 2 }}>
            <Popup>
              <b>Drop-off</b>
              <br />
              {dropoff.zone}
              <br />
              <span style={{ color: "#64748b" }}>{dropoff.borough}</span>
            </Popup>
          </CircleMarker>
        )}

        {routeArc && (
          <Polyline
            positions={routeArc as any}
            pathOptions={{
              color: routeColor,
              weight: 4,
              opacity: 0.85,
              className: "route-line",
            }}
          />
        )}

        <FitBounds pickup={pickup} dropoff={dropoff} />
      </MapContainer>

      {/* Map legend */}
      <div className="absolute bottom-3 left-3 glass rounded-xl px-3 py-2 text-xs text-slate-200 flex items-center gap-3">
        <span className="font-semibold tracking-wide text-slate-300">Demand pressure</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#22d3ee" }} /> low</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#facc15" }} /> medium</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#ff4b4b" }} /> high</span>
      </div>

      {prediction && (
        <div className="absolute top-3 right-3 glass rounded-xl px-4 py-3 text-slate-100 shadow-glow">
          <div className="text-xs uppercase tracking-wider text-slate-400">Predicted ETA</div>
          <div className="text-3xl font-extrabold">{prediction.ensemble_minutes.toFixed(1)}<span className="text-base font-medium text-slate-400 ml-1">min</span></div>
          <div className="text-xs text-slate-400">Confidence {(prediction.confidence * 100).toFixed(0)}%</div>
        </div>
      )}
    </div>
  );
}
