import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import "./itineraryAgency.css";

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

function isTravelAgencyType(t) {
  const s = (t ?? "").toString().toLowerCase().trim();
  if (!s) return false;
  const keywords = [
    "tour operator",
    "travel agency",
    "travel and tour",
    "travel and tours",
    "tour agency",
    "tour and travel",
    "tours agency",
    "travel agent",
    "tourism enterprise",
  ];
  return keywords.some((k) => s.includes(k));
}

// Load and normalize ALL rows for a region
async function loadAllRows(regionLabel) {
  const config = REGION_FILES.find((r) => r.label === regionLabel);
  if (!config) throw new Error(`Unknown region: ${regionLabel}`);

  const fileName = config.file;
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

// UPDATED: Helper function to detect if string is an email
function isEmail(str) {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str.trim());
}

// UPDATED: Helper function to detect if string is a URL
function isWebsiteURL(str) {
  if (!str) return false;
  const s = str.trim().toLowerCase();
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("www.") ||
    s.includes(".com") ||
    s.includes(".ph") ||
    s.includes(".net") ||
    s.includes(".org") ||
    s.includes(".gov")
  );
}

export default function ItineraryAgencyModal({ open, onClose, onSelect }) {
  const [region, setRegion] = useState("NCR");
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [locationFilter, setLocationFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Add this email handler function
  const handleEmailClick = (email, e) => {
    e.preventDefault();
    e.stopPropagation();

    const choice = window.confirm(
      `Send email to ${email}?\n\nOK = Open Gmail\nCancel = Use default email app`
    );

    if (choice) {
      // Open Gmail
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`,
        '_blank'
      );
    } else {
      // Open default email client
      window.location.href = `mailto:${email}`;
    }
  };

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
      if (!isTravelAgencyType(row.type)) return;
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
    let rows = allRows.filter((row) => isTravelAgencyType(row.type));

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
    <div className="agency-backdrop" onClick={onClose}>
      <div className="agency-modal" onClick={(e) => e.stopPropagation()}>
        <div className="agency-header">
          <div className="agency-title">
            ✈️ DOT-Accredited Travel Agencies & Tour Operators
          </div>
          <button className="agency-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="agency-controls">
          <label className="agency-label">
            Region
            <select
              className="agency-select"
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

          <label className="agency-label">
            {region === "NCR" ? "City" : "Province"}
            <select
              className="agency-select"
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

          <label className="agency-label">
            Search
            <input
              className="agency-input"
              placeholder="Search by name or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="agency-body">
          {loading ? (
            <div className="agency-info">Loading travel agencies…</div>
          ) : error ? (
            <div className="agency-error">{error.message}</div>
          ) : filtered.length === 0 ? (
            <div className="agency-info">
              No travel agencies found. Try adjusting the filters.
            </div>
          ) : (
            <ul className="agency-list">
              {filtered.map((row) => {
                const websiteValue = row.website?.trim();
                const isEmailAddress = isEmail(websiteValue);
                const isWebsite = !isEmailAddress && isWebsiteURL(websiteValue);

                return (
                  <li
                    className="agency-item"
                    key={`${row.accNo}-${row.name}-${row.address}`}
                  >
                    <div className="agency-item-main">
                      <div className="agency-name">{row.name || "—"}</div>
                      <div className="agency-meta">
                        <span className="agency-badge">
                          {row.type || "Travel Agency"}
                        </span>
                        <span className="agency-dot">•</span>
                        <span>
                          {region === "NCR"
                            ? row.city || "N/A"
                            : row.province || "N/A"}
                        </span>
                      </div>
                      <div className="agency-address">
                        {row.address || "No address"}
                      </div>
                      <div className="agency-contact">
                        {row.phone && <span>☎ {row.phone}</span>}
                        
                        {isEmailAddress && (
                          <a
                            href="#"
                            className="agency-email-link"
                            title={`Send email to ${websiteValue}`}
                            onClick={(e) => handleEmailClick(websiteValue, e)}
                          >
                            ✉️ Email
                          </a>
                        )}
                        
                        {isWebsite && (
                          <a
                            href={
                              websiteValue.startsWith("http")
                                ? websiteValue
                                : `https://${websiteValue}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="agency-website-link"
                            title={websiteValue}
                            onClick={(e) => e.stopPropagation()}
                          >
                            🌐 Website
                          </a>
                        )}

                        {websiteValue && !isEmailAddress && !isWebsite && (
                          <span className="agency-contact-info" title={websiteValue}>
                            📋 {websiteValue}
                          </span>
                        )}
                        
                        {row.validity && (
                          <span className="agency-valid">
                            Valid until: {row.validity}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}