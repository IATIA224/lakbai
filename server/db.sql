CREATE TABLE IF NOT EXISTS files (
  name TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content_json JSONB DEFAULT NULL,
  content_text TEXT DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fares (
  id SERIAL PRIMARY KEY,
  vehicle_type TEXT,
  sub_type TEXT,
  base_rate NUMERIC,
  rate_per_km NUMERIC,
  per_min NUMERIC,
  raw JSONB,
  UNIQUE(vehicle_type, sub_type)
);--ltfrb fare structure