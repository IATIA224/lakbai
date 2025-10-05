import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import "./itineraryHotels.css";

// List of region CSVs (match your assets/data folder)
const REGION_FILES = [
  { label: "NCR", file: "NCR.csv" },
  { label: "CAR", file: "CAR.csv" },
  { label: "Region 1", file: "Region 1.csv" },
  { label: "Region 2", file: "Region 2.csv" },
  { label: "Region 3", file: "Region 3.csv" },
  { label: "Region 4A", file: "Region 4A.csv" },
  { label: "Region 4b", file: "Region 4b.csv" },
  { label: "Region 5", file: "Region 5.csv" },
  { label: "Region 6", file: "Region 6.csv" },
  { label: "Region 7", file: "Region 7.csv" },
  { label: "Region 8", file: "Region 8.csv" },
  { label: "Region 9", file: "Region 9.csv" },
  { label: "Region 10", file: "Region 10.csv" },
  { label: "Region 11", file: "Region 11.csv" },
  { label: "Region 12", file: "Region 12.csv" },
  { label: "Region 13", file: "Region 13.csv" },
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
async function loadAllRows(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load CSV: ${res.status}`);
  const text = await res.text();
  const { rows } = parseCSV(text);

  return rows.map((r) => ({
    region: norm(r["Region"]),
    type: norm(r["Enterprise Type"]),
    accNo: norm(r["Accreditation No"]),
    name: norm(r["Enterprise Name"]),
    city: norm(r["City"]), // Only for NCR
    province: norm(r["Province"]), // For other regions
    municipality: norm(r["Municipality"]), // For other regions
    address: norm(r["Business Address"]),
    phone: norm(r["Contact Numbers"]),
    website: norm(r["Business Website"]),
    validity: norm(r["Accreditation Validity"]),
  }));
}

export default function ItineraryHotelsModal({ open, onClose, onSelect }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [all, setAll] = useState([]);
  const [region, setRegion] = useState(REGION_FILES[0].label); // Default to NCR
  const [citySel, setCitySel] = useState("");
  const [provinceSel, setProvinceSel] = useState("");
  const [cityText, setCityText] = useState(""); // <-- Add this
  const [regionFilter, setRegionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  // Load CSV when region changes
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setErr(null);
    setAll([]);
    setCitySel("");
    setProvinceSel("");
    const regionObj = REGION_FILES.find((r) => r.label === region);
    const url = `/data/${regionObj.file}`;
    loadAllRows(url)
      .then((rows) => {
        if (!mounted) return;
        setAll(rows);
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(e);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, region]);

  // Get cities for NCR, provinces for others
  function normalizeCity(city) {
    if (!city) return "";
    let c = city.trim().toLowerCase();
    c = c.replace(/ city$/, "");
    c = c.replace(/\s+/g, " ");
    return c.charAt(0).toUpperCase() + c.slice(1);
  }

  function normalizeProvince(province) {
    if (!province) return "";
    let p = province.trim().toLowerCase();
    p = p.replace(/\s+/g, " ");
    return p.charAt(0).toUpperCase() + p.slice(1);
  }

  const cities = useMemo(() => {
    if (region === "NCR") {
      const set = new Set();
      all.forEach((r) => {
        if (r.city) set.add(normalizeCity(r.city));
      });
      return Array.from(set)
        .map((c) => c + " City")
        .sort((a, b) => a.localeCompare(b));
    }
    return [];
  }, [all, region]);

  const provinces = useMemo(() => {
    if (region !== "NCR") {
      const set = new Set();
      all.forEach((r) => {
        if (r.province && isAccommodationType(r.type)) {
          set.add(normalizeProvince(r.province));
        }
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    }
    return [];
  }, [all, region]);

  // Filter results
  const results = useMemo(() => {
    let rows = all.filter((r) => isAccommodationType(r.type));
    if (region === "NCR" && citySel) {
      rows = rows.filter(
        (r) => normalizeCity(r.city) + " City" === citySel
      );
    } else if (region !== "NCR" && provinceSel) {
      rows = rows.filter(
        (r) => normalizeProvince(r.province) === normalizeProvince(provinceSel)
      );
    }
    if (cityText) {
      const normText = cityText.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.city && r.city.toLowerCase().includes(normText)) ||
          (r.municipality && r.municipality.toLowerCase().includes(normText)) ||
          (r.province && r.province.toLowerCase().includes(normText))
      );
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
  }, [all, region, citySel, provinceSel, cityText]);

  if (!open) return null;

  const modalContent = (
    <div className="hotels-backdrop" onClick={onClose}>
      <div className="hotels-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hotels-header">
          <div className="hotels-title">🏨 DOT-Accredited Hotels & Accommodations</div>
          <button className="hotels-close" onClick={onClose}>×</button>
        </div>

        <div className="hotels-controls">
          <label className="hotels-label">
            Region
            <select
              className="hotels-select"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              <option value="">All Regions</option>
              {REGION_FILES.map((r) => (
                <option key={r.label} value={r.label}>{r.label}</option>
              ))}
            </select>
          </label>

          <label className="hotels-label">
            Type
            <select
              className="hotels-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {all.map((a) => (
                <option key={a.type} value={a.type}>{a.type}</option>
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
          {error ? (
            <div className="hotels-error">{error}</div>
          ) : results.length === 0 ? (
            <div className="hotels-info">
              No hotels found matching your criteria. Try adjusting the filters.
            </div>
          ) : (
            <ul className="hotels-list">
              {results.map((r) => (
                <li className="hotels-item" key={`${r.accNo}-${r.name}-${r.address}`}>
                  <div className="hotels-item-main">
                    <div className="hotels-name">{r.name || "—"}</div>
                    <div className="hotels-meta">
                      <span className="hotels-badge">{r.type || "Accommodation"}</span>
                      <span className="hotels-dot">•</span>
                      {region === "NCR" ? (
                        <span>{r.city}</span>
                      ) : (
                        <span>{r.province}</span>
                      )}
                    </div>
                    <div className="hotels-address">{r.address || "No address"}</div>
                    <div className="hotels-contact">
                      {r.phone ? <span>☎ {r.phone}</span> : null}
                      {r.website ? (
                        /^[\w\-.]+@(?:gmail\.com|yahoo\.com|outlook\.com|hotmail\.com)$/i.test(r.website.trim())
                          ? (
                            <a
                              href={`mailto:${r.website.trim()}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Email
                            </a>
                          )
                          : (
                            <a
                              href={r.website.trim().startsWith("http") ? r.website.trim() : `https://${r.website.trim()}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Website
                            </a>
                          )
                      ) : null}
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

  // Render to body using Portal
  return ReactDOM.createPortal(modalContent, document.body);
}