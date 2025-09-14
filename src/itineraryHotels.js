import React, { useEffect, useMemo, useState } from "react";
import "./itineraryHotels.css";

// Broad accommodation detector
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

// Helpers
function norm(v) {
  return (v ?? "").toString().trim();
}
function titleCaseCity(v) {
  // Remove trailing "city" (case-insensitive), then add it back once
  let s = norm(v).replace(/\s+/g, " ").toLowerCase().replace(/ city$/, "");
  if (!s) return "";
  s = s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
  return s.endsWith("City") ? s : s + " City";
}

// NCR city list and variants for matching in Business Address
const NCR_CITIES = [
  "Caloocan City",
  "Las Piñas City",
  "Makati City",
  "Malabon City",
  "Mandaluyong City",
  "Manila City",
  "Marikina City",
  "Muntinlupa City",
  "Navotas City",
  "Parañaque City",
  "Pasay City",
  "Pasig City",
  "Quezon City",
  "San Juan City",
  "Taguig City",
  "Valenzuela City",
];
const CITY_MATCHERS = NCR_CITIES.map((c) => {
  const plain = c.replace("ñ", "n").toLowerCase();
  return { city: c, needle: plain };
});

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
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
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

// Load and normalize ALL rows, then we’ll filter to accommodations
async function loadAllRows(url = "/data/NCR.csv") {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load CSV: ${res.status}`);
  const text = await res.text();
  const { rows } = parseCSV(text);

  return rows.map((r) => ({
    region: norm(r["Region"]),
    type: norm(r["Enterprise Type"]),
    accNo: norm(r["Accreditation No"]),
    name: norm(r["Enterprise Name"]),
    city: titleCaseCity(norm(r["City"])), // <--- Use only the City column
    address: norm(r["Business Address"]),
    phone: norm(r["Contact Numbers"]),
    website: norm(r["Business Website"]),
    validity: norm(r["Accreditation Validity"]),
  }));
}

/**
 * ItineraryHotelsModal
 * - Single selector: Business address (City in NCR)
 * - Shows only accommodation records that match the selected city
 */
export default function ItineraryHotelsModal({ open, onClose, onSelect }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [all, setAll] = useState([]);

  // Selected Business Address (City)
  // const [city, setCity] = useState("");
  const [citySel, setCitySel] = useState("");   // NEW: dropdown city
  const [cityText, setCityText] = useState(""); // NEW: typed city

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setErr(null);
    loadAllRows()
      .then((rows) => {
        if (!mounted) return;
        setAll(rows);
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        console.error("Load accommodations failed:", e);
        setErr(e);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open]);

  // NEW: dropdown lists all NCR cities
  const cities = useMemo(() => NCR_CITIES.slice().sort((a, b) => a.localeCompare(b)), []);

  // Only accommodations, filtered by selected/typed city
  const results = useMemo(() => {
    let rows = all.filter((r) => isAccommodationType(r.type));

    const normCity = (v) =>
      (v || "")
        .toString()
        .toLowerCase()
        .replace(/ city$/, "")
        .replace(/ñ/g, "n")
        .replace(/\s+/g, " ")
        .trim();

    const wanted = normCity(cityText) || normCity(citySel);
    if (wanted) {
      rows = rows.filter((r) => {
        const c = normCity(r.city);
        const a = normCity(r.address);
        // Match if city or address contains the wanted city (with or without "city")
        return (
          c === wanted ||
          c === wanted + " city" ||
          c === wanted.replace(/ city$/, "") ||
          a.includes(wanted)
        );
      });
    }

    // Deduplicate by name + address
    const seen = new Set();
    const unique = [];
    for (const r of rows) {
      const key = `${r.name}|${r.address}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(r);
    }
    return unique;
  }, [all, citySel, cityText]);

  if (!open) return null;

  return (
    <div className="hotels-backdrop" onClick={onClose}>
      <div className="hotels-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hotels-header">
          <div className="hotels-title">Accredited accommodations</div>
          <button className="hotels-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="hotels-controls">
          <label className="hotels-label">
            Business address (City)
            <select
              className="hotels-select"
              value={citySel}
              onChange={(e) => setCitySel(e.target.value)}
            >
              <option value="">All NCR cities…</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="hotels-label">
            Or type city
            <input
              className="hotels-input"
              placeholder="e.g. Pasig City"
              value={cityText}
              onChange={(e) => setCityText(e.target.value)}
            />
          </label>
        </div>

        <div className="hotels-body">
          {loading ? (
            <div className="hotels-info">Loading…</div>
          ) : err ? (
            <div className="hotels-error">Failed to load: {err.message}</div>
          ) : results.length === 0 ? (
            <div className="hotels-info">No accredited accommodations found for this city.</div>
          ) : (
            <ul className="hotels-list">
              {results.map((r) => (
                <li className="hotels-item" key={`${r.accNo}-${r.name}-${r.address}`}>
                  <div className="hotels-item-main">
                    <div className="hotels-name">{r.name || "—"}</div>
                    <div className="hotels-meta">
                      <span className="hotels-badge">{r.type || "Accommodation"}</span>
                      <span className="hotels-dot">•</span>
                      <span>{r.city}</span>
                    </div>
                    <div className="hotels-address">{r.address || "No address"}</div>
                    <div className="hotels-contact">
                      {r.phone ? <span>☎ {r.phone}</span> : null}
                      {r.website ? <a href={r.website} target="_blank" rel="noreferrer">Website</a> : null}
                      {r.validity ? <span className="hotels-valid">Valid until: {r.validity}</span> : null}
                    </div>
                  </div>
                  <div className="hotels-item-actions">
                    <button
                      className="hotels-select-btn"
                      onClick={() => onSelect && onSelect(r)}
                      title="Add this accommodation to itinerary"
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
    </div>
  );
}