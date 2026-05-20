export type Zone = {
  id: number;
  zone: string;
  borough: string;
  service_zone?: string;
  lat: number | null;
  lng: number | null;
};

export type HeatCell = {
  id: number;
  zone: string;
  borough: string;
  lat: number;
  lng: number;
  pressure: number;
};

export type ModelPrediction = { model: string; duration_minutes: number };

export type ShapContribution = {
  feature: string;
  value: string;
  contribution_minutes: number;
};

export type ConformalInterval = {
  level: number;
  lower_minutes: number;
  upper_minutes: number;
  half_width_minutes: number;
};

export type PredictResponse = {
  ensemble_minutes: number;
  spread_minutes: number;
  confidence: number;
  per_model: ModelPrediction[];
  context: {
    pickup_hour: number;
    is_rush_hour: number;
    is_weekend: number;
    pickup_borough: string;
    dropoff_borough: string;
  };
  shap: ShapContribution[];
  shap_base_minutes: number;
  intervals: ConformalInterval[];
};

export type PredictRequest = {
  pickup_location_id: number;
  dropoff_location_id: number;
  trip_distance: number;
  pickup_datetime: string;
  temperature: number;
  is_rainy: boolean;
};

const BASE = ""; // proxied via Vite

export async function getZones(): Promise<Zone[]> {
  const r = await fetch(`${BASE}/api/zones`);
  if (!r.ok) throw new Error("zones");
  return r.json();
}

export async function getGeoJson(): Promise<GeoJSON.FeatureCollection> {
  const r = await fetch(`${BASE}/api/geojson`);
  if (!r.ok) throw new Error("geojson");
  return r.json();
}

export async function getHeatmap(hour: number, isWeekend: boolean): Promise<HeatCell[]> {
  const r = await fetch(`${BASE}/api/heatmap?hour=${hour}&is_weekend=${isWeekend ? 1 : 0}`);
  if (!r.ok) throw new Error("heatmap");
  return r.json();
}

export async function predict(req: PredictRequest): Promise<PredictResponse> {
  const r = await fetch(`${BASE}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!r.ok) throw new Error((await r.text()) || "predict");
  return r.json();
}
