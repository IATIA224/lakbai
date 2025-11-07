import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import "./ItinerarySuggestion.css";
import "./itineraryHotels.css";
import "./itineraryAgency.css";

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

  function getRegionCode(details) {
    if (!details || !details.region) return "NCR";
    let regionCode = (details.region.split(" - ")[0] || "").trim();

    const romanMap = {
        "XIII": "13", "XII": "12", "XI": "11", "X": "10", "IX": "9", 
        "VIII": "8", "VII": "7", "VI": "6", "V": "5", "IV": "4", 
        "III": "3", "II": "2", "I": "1"
    };
    const regionParts = regionCode.split(" ");
    if (regionParts.length === 2 && regionParts[0] === "Region" && romanMap[regionParts[1]]) {
        regionCode = `Region ${romanMap[regionParts[1]]}`;
    }

    if (regionCode === "Region 4") {
        if (details.region.includes("CALABARZON")) return "Region 4A";
        if (details.region.includes("MIMAROPA")) return "Region 4b";
    }
    
    if (REGION_FILES.some(r => r.label === regionCode)) {
        return regionCode;
    }
    
    const originalRegionCode = (details.region.split(" - ")[0] || "").trim();
    if (REGION_FILES.some(r => r.label === originalRegionCode)) {
        return originalRegionCode;
    }

    return "NCR"; // Default fallback
}
  
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
  
function isAccommodationType(t) {
    const s = (t ?? "").toString().toLowerCase().trim();
    if (!s) return false;
    const keywords = [
      "hotel", "apartment hotel", "apartment", "apartelle", "accommodation",
      "accomodation", "resort", "inn", "hostel", "motel", "lodging", "pension",
      "bed and breakfast", "b&b", "bnb", "transient", "serviced apartment",
      "residences", "residence", "suites",
    ];
    return keywords.some((k) => s.includes(k));
  }
  
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
    return city.trim().toLowerCase().replace(/\s+/g, " ").replace(/ city$/i, "").replace(/\b./g, (c) => c.toUpperCase());
  }
  
function normalizeProvince(province) {
    if (!province) return "";
    return province.trim().toLowerCase().replace(/\s+/g, " ").replace(/\b./g, (c) => c.toUpperCase());
  }

function isTravelAgencyType(t) {
    const s = (t ?? "").toString().toLowerCase().trim();
    if (!s) return false;
    const keywords = [
      "tour operator", "travel agency", "travel and tour", "travel and tours",
      "tour agency", "tour and travel", "tours agency", "travel agent",
      "tourism enterprise",
    ];
    return keywords.some((k) => s.includes(k));
  }

function isEmail(str) {
    if (!str) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(str.trim());
  }
  
function isWebsiteURL(str) {
    if (!str) return false;
    const s = str.trim().toLowerCase();
    return (
      s.startsWith("http://") || s.startsWith("https://") || s.startsWith("www.") ||
      s.includes(".com") || s.includes(".ph") || s.includes(".net") ||
      s.includes(".org") || s.includes(".gov")
    );
  }

export function HotelSuggestion({ details, onSelect }) {
    const [allRows, setAllRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [region, setRegion] = useState("NCR");
    const [locationFilter, setLocationFilter] = useState("");
  
    useEffect(() => {
      const regionToLoad = getRegionCode(details);
      setRegion(regionToLoad);
  
      let active = true;
      setLoading(true);
      setError(null);
      setAllRows([]);
  
      loadAllRows(regionToLoad)
        .then((rows) => {
          if (!active) return;
          setAllRows(rows);
          setLoading(false);
  
          if (details && details.location) {
            const locationParts = details.location.split(",").map((p) => p.trim());
            const province = locationParts.length > 0 ? locationParts[locationParts.length - 1] : null;
  
            if (province) {
              const availableLocations = new Set();
              rows.forEach((row) => {
                if (!isAccommodationType(row.type)) return;
                if (regionToLoad === "NCR" && row.city) {
                  const c = normalizeCity(row.city);
                  if (c) availableLocations.add(`${c} City`);
                } else if (regionToLoad !== "NCR" && row.province) {
                  availableLocations.add(normalizeProvince(row.province));
                }
              });
  
              const normalizedProvince = normalizeProvince(province);
              const foundLocation = [...availableLocations].find(loc => normalizeProvince(loc) === normalizedProvince);
  
              if (foundLocation) {
                setLocationFilter(foundLocation);
              } else {
                setLocationFilter("");
              }
            } else {
              setLocationFilter("");
            }
          } else {
            setLocationFilter("");
          }
        })
        .catch((err) => {
          if (!active) return;
          console.error(`Failed loading ${regionToLoad}:`, err);
          setError(err);
          setLoading(false);
        });
  
      return () => {
        active = false;
      };
    }, [details]);
  
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
  
      const seen = new Set();
      return rows.filter((row) => {
        const key = `${row.name}|${row.address}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }, [allRows, region, locationFilter]);
  
    return (
      <div className="suggestion-form">
        <h3>Hotel Suggestions</h3>
        <div className="hotels-body">
          {loading ? (
            <div className="hotels-info">Loading accommodations…</div>
          ) : error ? (
            <div className="hotels-error">{error.message}</div>
          ) : filtered.length === 0 ? (
            <div className="hotels-info">
              No hotels found.
            </div>
          ) : (
            <ul className="hotels-list">
              {filtered.map((row) => {
                const websiteValue = row.website?.trim();
                const isWebsite = isWebsiteURL(websiteValue);

                return (
                  <li
                    className="hotels-item"
                    key={`${row.accNo}-${row.name}-${row.address}`}
                  >
                    <div className="hotels-item-main">
                      <div className="hotels-name">{row.name || "—"}</div>
                      <div className="hotels-meta">
                        <span className="hotels-badge">
                          {row.type || "Hotel"}
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
                        {isWebsite && (
                          <a
                            href={
                              websiteValue.startsWith("http")
                                ? websiteValue
                                : `https://${websiteValue}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hotels-website-link"
                            title={websiteValue}
                            onClick={(e) => e.stopPropagation()}
                          >
                            🌐 Website
                          </a>
                        )}
                        {websiteValue && !isWebsite && (
                          <span className="hotels-contact-info" title={websiteValue}>
                            📋 {websiteValue}
                          </span>
                        )}
                      </div>
                      {row.validity && (
                        <span className="hotels-valid">
                          Valid until: {row.validity}
                        </span>
                      )}
                      <button
                        className="itinerary-add-btn"
                        style={{ marginTop: "12px" }}
                        onClick={() => onSelect?.(row)}
                      >
                        Add to Itinerary
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }
  
  export function AgencySuggestion({ details, onSelect }) {
    const [allRows, setAllRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [region, setRegion] = useState("NCR");
    const [locationFilter, setLocationFilter] = useState("");
  
    const handleEmailClick = (email, e) => {
        e.preventDefault();
        e.stopPropagation();
    
        const choice = window.confirm(
          `Send email to ${email}?\n\nOK = Open Gmail\nCancel = Use default email app`
        );
    
        if (choice) {
          window.open(
            `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`,
            '_blank'
          );
        } else {
          window.location.href = `mailto:${email}`;
        }
      };

    useEffect(() => {
      const regionToLoad = getRegionCode(details);
      setRegion(regionToLoad);
  
      let active = true;
      setLoading(true);
      setError(null);
      setAllRows([]);
  
      loadAllRows(regionToLoad)
        .then((rows) => {
          if (!active) return;
          setAllRows(rows);
          setLoading(false);
  
          if (details && details.location) {
            const locationParts = details.location.split(",").map((p) => p.trim());
            const province = locationParts.length > 0 ? locationParts[locationParts.length - 1] : null;
  
            if (province) {
              const availableLocations = new Set();
              rows.forEach((row) => {
                if (!isTravelAgencyType(row.type)) return;
                if (regionToLoad === "NCR" && row.city) {
                  const c = normalizeCity(row.city);
                  if (c) availableLocations.add(`${c} City`);
                } else if (regionToLoad !== "NCR" && row.province) {
                  availableLocations.add(normalizeProvince(row.province));
                }
              });
  
              const normalizedProvince = normalizeProvince(province);
              const foundLocation = [...availableLocations].find(loc => normalizeProvince(loc) === normalizedProvince);
  
              if (foundLocation) {
                setLocationFilter(foundLocation);
              } else {
                setLocationFilter("");
              }
            } else {
              setLocationFilter("");
            }
          } else {
            setLocationFilter("");
          }
        })
        .catch((err) => {
          if (!active) return;
          console.error(`Failed loading ${regionToLoad}:`, err);
          setError(err);
          setLoading(false);
        });
  
      return () => {
        active = false;
      };
    }, [details]);
  
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
  
      const seen = new Set();
      return rows.filter((row) => {
        const key = `${row.name}|${row.address}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }, [allRows, region, locationFilter]);
  
    return (
      <div className="suggestion-form">
        <h3>Agency Suggestions</h3>
        <div className="agency-body">
          {loading ? (
            <div className="agency-info">Loading travel agencies…</div>
          ) : error ? (
            <div className="agency-error">{error.message}</div>
          ) : filtered.length === 0 ? (
            <div className="agency-info">
              No travel agencies found.
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
                      </div>
                      {row.validity && (
                        <span className="agency-valid">
                          Valid until: {row.validity}
                        </span>
                      )}
                      <button
                        className="itinerary-add-btn"
                        onClick={() => onSelect?.(row)}
                      >
                        Add to Itinerary
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

export function SuggestionView({ item, children, onClose, onSelectHotel, onSelectAgency }) {
  const viewContent = (
    <div className="suggestion-view-backdrop" onClick={onClose}>
      <div
        className="suggestion-view-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="suggestion-view-left">
          <HotelSuggestion details={item} onSelect={onSelectHotel} />
        </div>
        <div className="suggestion-view-center">{children}</div>
        <div className="suggestion-view-right">
          <AgencySuggestion details={item} onSelect={onSelectAgency} />
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(viewContent, document.body);
}

function EditDestinationModal({ initial, onSave, onClose }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState(() => ({
    // ...existing form state...
  }));

  // ...existing code...

  // REPLACE the modalContent div with proper modal styling
  const modalContent = (
    <div 
      className="itn-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: isMobile ? '8px' : '20px',
        overflowY: 'auto'
      }}
    >
      <div 
        className="itn-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: isMobile ? '100%' : '90%',
          maxWidth: isMobile ? '100%' : '1000px',
          maxHeight: isMobile ? '95vh' : '90vh',
          borderRadius: isMobile ? '16px' : '20px',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden'
        }}
      >
        <div className="itn-modal-header">
          <div className="itn-modal-title">{isMobile ? 'Edit Details' : 'Edit Destination Details'}</div>
          <button className="itn-close" onClick={onClose}>×</button>
        </div>

        {/* ADD THIS - Mobile View Mode Selector */}
        {isMobile && !isFromQuickAdd && (
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: '8px'
          }}>
            <button
              onClick={() => setMobileViewMode("form")}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: mobileViewMode === "form" ? '2px solid #6366f1' : '1px solid #e5e7eb',
                background: mobileViewMode === "form" ? '#eef2ff' : '#fff',
                color: mobileViewMode === "form" ? '#6366f1' : '#64748b',
                fontWeight: mobileViewMode === "form" ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ✏️ Details
            </button>
            <button
              onClick={() => setMobileViewMode("hotels")}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: mobileViewMode === "hotels" ? '2px solid #10b981' : '1px solid #e5e7eb',
                background: mobileViewMode === "hotels" ? '#ecfdf5' : '#fff',
                color: mobileViewMode === "hotels" ? '#10b981' : '#64748b',
                fontWeight: mobileViewMode === "hotels" ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🏨 Hotels
            </button>
            <button
              onClick={() => setMobileViewMode("agencies")}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: mobileViewMode === "agencies" ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                background: mobileViewMode === "agencies" ? '#fffbeb' : '#fff',
                color: mobileViewMode === "agencies" ? '#f59e0b' : '#64748b',
                fontWeight: mobileViewMode === "agencies" ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🛫 Agencies
            </button>
          </div>
        )}

        {/* Scrollable content area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          {/* CHANGED: Conditional rendering based on mobile view mode */}
          {(!isMobile || mobileViewMode === "form") && (
            <div className="itn-modal-body">
              {/* ...rest of form content... */}
            </div>
          )}

          {/* ADD THIS - Mobile Hotels View */}
          {isMobile && mobileViewMode === "hotels" && (
            <div className="itn-modal-body" style={{ padding: '16px' }}>
              <HotelSuggestion details={initial} onSelect={handleSelectHotel} />
            </div>
          )}

          {/* ADD THIS - Mobile Agencies View */}
          {isMobile && mobileViewMode === "agencies" && (
            <div className="itn-modal-body" style={{ padding: '16px' }}>
              <AgencySuggestion details={initial} onSelect={handleSelectAgency} />
            </div>
          )}
        </div>

        <div className="itn-modal-footer">
          <button className="itn-btn ghost" onClick={onClose}>Cancel</button>
          {!isMobile || mobileViewMode === "form" ? (
            <button className="itn-btn primary" onClick={handleSave}>Save Details</button>
          ) : null}
        </div>

        {notif && (
          <div
            style={{
              position: "fixed",
              top: 20,
              right: 20,
              background: "#6c63ff",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 10000,
            }}
          >
            {notif}
          </div>
        )}
      </div>
    </div>
  );

  // Return to body using Portal
  return ReactDOM.createPortal(modalContent, document.body);
}