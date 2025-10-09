import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import "./itineraryHotels.css";

// List of region CSVs (match your assets/data folder)
const REGION_FILES = [
  { label: "NCR", file: "NCR.csv" },
  { label: "CAR", file: "CAR.csv" },
  { label: "Region 1", file: "Region1.csv" },
  { label: "Region 2", file: "Region2.csv" },
  { label: "Region 3", file: "Region3.csv" },
  { label: "Region 4A", file: "Region4A.csv" },
  { label: "Region 4b", file: "Region4b.csv" },
  { label: "Region 5", file: "Region5.csv" },
  { label: "Region 6", file: "Region6.csv" },
  { label: "Region 7", file: "Region7.csv" },
  { label: "Region 8", file: "Region8.csv" },
  { label: "Region 9", file: "Region9.csv" },
  { label: "Region 10", file: "Region10.csv" },
  { label: "Region 11", file: "Region11.csv" },
  { label: "Region 12", file: "Region12.csv" },
  { label: "Region 13", file: "Region13.csv" },
];

// Minimal CSV parsing that supports quotes and commas
function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "").replace(/\u200B/g, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { header: [], rows: [] };
  const header = splitCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.every((c) => !c.trim())) continue;
    const row = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j] ?? `__col${j}`;
      row[key] = cols[j] ?? "";
    }
    rows.push(row);
  }
  return { header, rows };
}

function norm(v) {
  return (v ?? "").toString().trim();
}
function titleCase(v) {
  let s = norm(v).replace(/\s+/g, " ").toLowerCase();
  if (!s) return "";
  return s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
function isAccommodationType(t) {
  const s = (t ?? "").toString().toLowerCase().trim();
  if (!s) return false;
  const keywords = [
    "hotel",
    "apartment hotel",
    "apartment",
    "apartelle",
    "accommodation",
    "accomodation",
    "resort",
    "inn",
    "hostel",
    "motel",
    "lodging",
    "pension",
    "bed and breakfast",
    "b&b",
    "bnb",
    "transient",
    "serviced apartment",
    "residences",
    "residence",
    "suites",
  ];
  return keywords.some((k) => s.includes(k));
}

// Load and normalize ALL rows for a region
async function loadAllRows(regionLabel) {
  const config = REGION_FILES.find((r) => r.label === regionLabel);
  if (!config) throw new Error(`Unknown region: ${regionLabel}`);

  const fileName = config.file; // No need to encode anymore since no spaces
  const publicRoot = process.env.PUBLIC_URL || "";

  const candidates = [
    `${publicRoot}/data/${fileName}`,
    `${publicRoot}/assets/data/${fileName}`,
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastError = new Error(`Failed to load CSV: ${res.status}`);
        continue;
      }
      const text = await res.text();
      const { rows } = parseCSV(text);
      return rows.map((r) => ({
        region: norm(r["Region"]),
        type: norm(r["Enterprise Type"]),
        accNo: norm(r["Accreditation No"]),
        name: norm(r["Enterprise Name"]),
        city: norm(r["City"]),
        province: norm(r["Province"]),
        municipality: norm(r["Municipality"]),
        address: norm(r["Business Address"]),
        phone: norm(r["Contact Numbers"]),
        website: norm(r["Business Website"]),
        validity: norm(r["Accreditation Validity"]),
      }));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Unable to load ${config.file}`);
}

function normalizeCity(city) {
  if (!city) return "";
  return city
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ city$/i, "")
    .replace(/\b./g, (c) => c.toUpperCase());
}

function normalizeProvince(province) {
  if (!province) return "";
  return province
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b./g, (c) => c.toUpperCase());
}

export default function ItineraryHotelsModal({ open, onClose, onSelect }) {
  const [region, setRegion] = useState("NCR");
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [locationFilter, setLocationFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    setAllRows([]);
    setLocationFilter("");

    loadAllRows(region)
      .then((rows) => {
        if (!active) return;
        setAllRows(rows);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error(`Failed loading ${region}:`, err);
        setError(err);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, region]);

  const locations = useMemo(() => {
    const set = new Set();
    allRows.forEach((row) => {
      if (!isAccommodationType(row.type)) return;
      if (region === "NCR" && row.city) {
        const c = normalizeCity(row.city);
        if (c) set.add(`${c} City`);
      } else if (region !== "NCR" && row.province) {
        set.add(normalizeProvince(row.province));
      }
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allRows, region]);

  const filtered = useMemo(() => {
    let rows = allRows.filter((row) => isAccommodationType(row.type));

    if (locationFilter) {
      if (region === "NCR") {
        rows = rows.filter(
          (row) => `${normalizeCity(row.city)} City` === locationFilter
        );
      } else {
        rows = rows.filter(
          (row) =>
            normalizeProvince(row.province) === normalizeProvince(locationFilter)
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          row.address.toLowerCase().includes(q) ||
          row.city.toLowerCase().includes(q) ||
          row.municipality.toLowerCase().includes(q) ||
          row.province.toLowerCase().includes(q)
      );
    }

    const seen = new Set();
    return rows.filter((row) => {
      const key = `${row.name}|${row.address}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allRows, region, locationFilter, searchQuery]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="hotels-backdrop" onClick={onClose}>
      <div className="hotels-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hotels-header">
          <div className="hotels-title">
            🏨 DOT-Accredited Hotels & Accommodations
          </div>
          <button className="hotels-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="hotels-controls">
          <label className="hotels-label">
            Region
            <select
              className="hotels-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {REGION_FILES.map((r) => (
                <option key={r.label} value={r.label}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="hotels-label">
            {region === "NCR" ? "City" : "Province"}
            <select
              className="hotels-select"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">
                All {region === "NCR" ? "Cities" : "Provinces"}
              </option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>

          <label className="hotels-label">
            Search
            <input
              className="hotels-input"
              placeholder="Search by name or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="hotels-body">
          {loading ? (
            <div className="hotels-info">Loading accommodations…</div>
          ) : error ? (
            <div className="hotels-error">{error.message}</div>
          ) : filtered.length === 0 ? (
            <div className="hotels-info">
              No hotels found. Try adjusting the filters.
            </div>
          ) : (
            <ul className="hotels-list">
              {filtered.map((row) => (
                <li
                  className="hotels-item"
                  key={`${row.accNo}-${row.name}-${row.address}`}
                >
                  <div className="hotels-item-main">
                    <div className="hotels-name">{row.name || "—"}</div>
                    <div className="hotels-meta">
                      <span className="hotels-badge">
                        {row.type || "Accommodation"}
                      </span>
                      <span className="hotels-dot">•</span>
                      <span>
                        {region === "NCR"
                          ? row.city || "N/A"
                          : row.province || "N/A"}
                      </span>
                    </div>
                    <div className="hotels-address">
                      {row.address || "No address"}
                    </div>
                    <div className="hotels-contact">
                      {row.phone && <span>☎ {row.phone}</span>}
                      {row.website && (
                        <a
                          href={
                            row.website.startsWith("http")
                              ? row.website
                              : `https://${row.website}`
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          Website
                        </a>
                      )}
                      {row.validity && (
                        <span className="hotels-valid">
                          Valid until: {row.validity}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="hotels-item-actions">
                    <button
                      className="hotels-select-btn"
                      onClick={() => onSelect?.(row)}
                    >
                      Add in itinerary
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}