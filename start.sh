#!/usr/bin/env bash
# UrbanFlow one-shot launcher (macOS / Linux)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> Installing Python dependencies..."
python3 -m pip install --quiet -r backend/requirements.txt

echo "==> Starting FastAPI on http://localhost:8000"
(cd backend && python3 -m uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!
trap "kill $BACKEND_PID 2>/dev/null || true" EXIT

sleep 2

if [ ! -d "frontend/node_modules" ]; then
  echo "==> Installing Node dependencies (first run only)..."
  (cd frontend && npm install)
fi

echo "==> Starting React dev server on http://localhost:5173"
(cd frontend && npm run dev)
