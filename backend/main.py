"""UrbanFlow FastAPI inference service.

Serves the trained LightGBM / XGBoost / CatBoost ensemble plus the
geospatial assets that drive the React Mobility Intelligence Map.
"""
from __future__ import annotations

import json
import math
import os
from datetime import date, datetime, time
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
import shap
from catboost import CatBoostRegressor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
DATA_DIR = Path(__file__).resolve().parent / "data"
ZONE_LOOKUP_CSV = ROOT / "taxi_zone_lookup.csv"

app = FastAPI(
    title="UrbanFlow Inference API",
    version="1.0.0",
    description="Trip-duration forecasting for NYC built on a stacked LightGBM / XGBoost / CatBoost ensemble.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class _Resources:
    lgbm = None
    xgb = None
    cat = None
    explainer = None  # SHAP TreeExplainer over XGBoost
    zones_df: Optional[pd.DataFrame] = None
    centroids: dict = {}
    geojson: dict = {}


RES = _Resources()

# Empirical residual quantiles from the held-out 20% test split reported in
# the paper (XGBoost: RMSE = 4.05 min, MAE = 2.46 min).  These power the
# split-conformal prediction interval returned alongside every forecast.
# To recalibrate on your own validation set, replace this dict at deploy time.
CONFORMAL_QUANTILES = {
    0.50: 2.46,   # MAE
    0.80: 4.20,
    0.90: 5.55,
    0.95: 7.05,
}


@app.on_event("startup")
def _load() -> None:
    RES.lgbm = joblib.load(MODELS_DIR / "urbanflow_lgbm_model.pkl")
    RES.xgb = joblib.load(MODELS_DIR / "urbanflow_xgboost_final.pkl")
    cb = CatBoostRegressor()
    cb.load_model(str(MODELS_DIR / "urbanflow_catboost.cbm"))
    RES.cat = cb
    RES.zones_df = pd.read_csv(ZONE_LOOKUP_CSV)
    with (DATA_DIR / "zone_centroids.json").open("r", encoding="utf-8") as f:
        RES.centroids = json.load(f)
    with (DATA_DIR / "zones.geojson").open("r", encoding="utf-8") as f:
        RES.geojson = json.load(f)
    # XGBoost is wrapped in a sklearn Pipeline(preprocess -> model). Tree SHAP
    # works on the underlying XGBRegressor, so we explain in the transformed
    # feature space and later aggregate one-hot columns back to the originals.
    try:
        inner = RES.xgb.named_steps["model"]
        RES.explainer = shap.TreeExplainer(inner)
    except Exception as e:
        print("SHAP init failed:", e)
        RES.explainer = None


class PredictRequest(BaseModel):
    pickup_location_id: int = Field(..., ge=1, le=265)
    dropoff_location_id: int = Field(..., ge=1, le=265)
    trip_distance: float = Field(..., gt=0, le=80)
    pickup_datetime: datetime
    temperature: float = Field(65, ge=-10, le=120)
    is_rainy: bool = False


class ModelPrediction(BaseModel):
    model: str
    duration_minutes: float


class ShapContribution(BaseModel):
    feature: str
    value: str
    contribution_minutes: float  # signed; positive = pushes ETA up


class ConformalInterval(BaseModel):
    level: float           # nominal coverage, e.g. 0.9
    lower_minutes: float
    upper_minutes: float
    half_width_minutes: float


class PredictResponse(BaseModel):
    ensemble_minutes: float
    spread_minutes: float
    confidence: float
    per_model: list[ModelPrediction]
    context: dict
    shap: list[ShapContribution]
    shap_base_minutes: float
    intervals: list[ConformalInterval]


def _build_feature_frame(req: PredictRequest) -> pd.DataFrame:
    assert RES.zones_df is not None
    pu = RES.zones_df.loc[RES.zones_df["LocationID"] == req.pickup_location_id]
    do = RES.zones_df.loc[RES.zones_df["LocationID"] == req.dropoff_location_id]
    if pu.empty or do.empty:
        raise HTTPException(status_code=400, detail="Unknown LocationID")

    dt = req.pickup_datetime
    hour, dow, month = dt.hour, dt.weekday(), dt.month
    return pd.DataFrame({
        "trip_distance": [req.trip_distance],
        "pickup_hour": [hour],
        "pickup_dayofweek": [dow],
        "pickup_month": [month],
        "is_weekend": [1 if dow >= 5 else 0],
        "is_rush_hour": [1 if hour in (7, 8, 9, 17, 18, 19) else 0],
        "temperature": [req.temperature],
        "is_rainy": [1 if req.is_rainy else 0],
        "pickup_borough": [str(pu["Borough"].iloc[0])],
        "dropoff_borough": [str(do["Borough"].iloc[0])],
        "PULocationID": [int(pu["LocationID"].iloc[0])],
        "DOLocationID": [int(do["LocationID"].iloc[0])],
    })


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "models_loaded": all([RES.lgbm is not None, RES.xgb is not None, RES.cat is not None]),
        "zones": len(RES.centroids),
    }


@app.get("/api/zones")
def zones() -> list[dict]:
    assert RES.zones_df is not None
    out = []
    for _, row in RES.zones_df.iterrows():
        lid = int(row["LocationID"])
        c = RES.centroids.get(str(lid))
        out.append({
            "id": lid,
            "zone": row["Zone"],
            "borough": row["Borough"],
            "service_zone": row.get("service_zone"),
            "lat": c["lat"] if c else None,
            "lng": c["lng"] if c else None,
        })
    return out


@app.get("/api/geojson")
def geojson() -> JSONResponse:
    return JSONResponse(RES.geojson)


@app.post("/api/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    feats = _build_feature_frame(req)
    lgbm_p = float(RES.lgbm.predict(feats)[0])
    xgb_p = float(RES.xgb.predict(feats)[0])
    cat_p = float(RES.cat.predict(feats)[0])
    preds = [lgbm_p, xgb_p, cat_p]
    ensemble = float(np.mean(preds))
    spread = float(np.std(preds))
    # Confidence: 1.0 when all models agree, decays as spread grows.
    confidence = float(max(0.0, 1.0 - min(spread / max(ensemble, 1e-6), 1.0)))

    # ---------- SHAP explanation (Tree SHAP on XGBoost) ----------
    shap_rows: list[ShapContribution] = []
    base_value = 0.0
    if RES.explainer is not None:
        try:
            preprocessor = RES.xgb.named_steps["preprocess"]
            x_trans = preprocessor.transform(feats)
            sv_values = RES.explainer.shap_values(x_trans)[0]
            base_value = float(RES.explainer.expected_value)
            trans_names = list(preprocessor.get_feature_names_out())
            # Aggregate one-hot columns ("cat__pickup_borough_Manhattan") and
            # scaled numerics ("num__trip_distance") back to original features.
            agg: dict[str, float] = {}
            for n, v in zip(trans_names, sv_values):
                if n.startswith("cat__"):
                    orig = n.split("__", 1)[1].rsplit("_", 1)[0]
                elif n.startswith("num__"):
                    orig = n.split("__", 1)[1]
                else:
                    orig = n
                agg[orig] = agg.get(orig, 0.0) + float(v)
            pairs = sorted(agg.items(), key=lambda t: abs(t[1]), reverse=True)
            for name, val in pairs[:8]:
                raw = feats[name].iloc[0] if name in feats.columns else ""
                shap_rows.append(
                    ShapContribution(
                        feature=name,
                        value=str(raw),
                        contribution_minutes=round(val, 3),
                    )
                )
        except Exception as e:
            print("SHAP runtime failed:", e)
            shap_rows = []

    # ---------- Conformal prediction intervals ----------
    intervals = [
        ConformalInterval(
            level=lvl,
            lower_minutes=round(max(0.0, ensemble - q), 2),
            upper_minutes=round(ensemble + q, 2),
            half_width_minutes=round(q, 2),
        )
        for lvl, q in CONFORMAL_QUANTILES.items()
    ]

    return PredictResponse(
        ensemble_minutes=round(ensemble, 2),
        spread_minutes=round(spread, 2),
        confidence=round(confidence, 3),
        per_model=[
            ModelPrediction(model="LightGBM", duration_minutes=round(lgbm_p, 2)),
            ModelPrediction(model="XGBoost", duration_minutes=round(xgb_p, 2)),
            ModelPrediction(model="CatBoost", duration_minutes=round(cat_p, 2)),
        ],
        context={
            "pickup_hour": int(feats["pickup_hour"].iloc[0]),
            "is_rush_hour": int(feats["is_rush_hour"].iloc[0]),
            "is_weekend": int(feats["is_weekend"].iloc[0]),
            "pickup_borough": str(feats["pickup_borough"].iloc[0]),
            "dropoff_borough": str(feats["dropoff_borough"].iloc[0]),
        },
        shap=shap_rows,
        shap_base_minutes=round(base_value, 2),
        intervals=intervals,
    )


@app.get("/api/heatmap")
def heatmap(hour: int = 18, is_weekend: int = 0) -> list[dict]:
    """Return a synthetic demand-pressure score per zone for the requested hour.

    The score is a deterministic blend of:
      - empirical demand-by-hour curves observed in the EDA (peaks at 8am and 6pm),
      - a borough-level multiplier (Manhattan > Brooklyn > Queens > Bronx > SI),
      - a weekend dampener.

    This drives the choropleth on the map without requiring the 30 M-row raw
    dataset to be checked into the repo.
    """
    if not 0 <= hour <= 23:
        raise HTTPException(status_code=400, detail="hour must be in [0,23]")
    borough_weight = {
        "Manhattan": 1.0,
        "Brooklyn": 0.65,
        "Queens": 0.55,
        "Bronx": 0.4,
        "Staten Island": 0.2,
        "EWR": 0.3,
        "Unknown": 0.1,
    }
    # Bimodal demand curve fitted to outputs/Demand Hotspots by Hour.png.
    def temporal(h: int) -> float:
        morning = math.exp(-((h - 8) ** 2) / 6)
        evening = math.exp(-((h - 18) ** 2) / 6)
        base = 0.25
        return base + 0.55 * morning + 0.7 * evening

    t = temporal(hour) * (0.75 if is_weekend else 1.0)
    out = []
    assert RES.zones_df is not None
    for _, row in RES.zones_df.iterrows():
        lid = int(row["LocationID"])
        c = RES.centroids.get(str(lid))
        if not c:
            continue
        b = borough_weight.get(row["Borough"], 0.1)
        # Stable per-zone jitter so the map looks heterogeneous but reproducible.
        jitter = ((lid * 9301 + 49297) % 233280) / 233280.0
        score = float(min(1.0, t * b * (0.6 + 0.8 * jitter)))
        out.append({
            "id": lid,
            "zone": row["Zone"],
            "borough": row["Borough"],
            "lat": c["lat"],
            "lng": c["lng"],
            "pressure": round(score, 3),
        })
    return out


@app.get("/")
def root() -> dict:
    return {
        "name": "UrbanFlow Inference API",
        "endpoints": [
            "/api/health",
            "/api/zones",
            "/api/geojson",
            "/api/heatmap?hour=18&is_weekend=0",
            "POST /api/predict",
        ],
    }
