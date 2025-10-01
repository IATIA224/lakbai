import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";
import "./itineraryCostEstimation.css";

const CSV_PATH = "/data/transport/Fare_LTFRB.csv";

const PHILIPPINES_BOUNDS = [
  [4.5, 116.8],
  [21.3, 126.6],
];

// New: Metro Manila bounds for a tighter preview
const METRO_MANILA_BOUNDS = [
  [14.3, 120.8], // southwest
  [14.9, 121.3], // northeast
];

// New: Taguig bounds for a closer preview
const TAGUIG_BOUNDS = [
  [14.52, 121.01], // southwest (approx)
  [14.60, 121.09], // northeast (approx)
];

// Helper for Nominatim search restricted to Philippines
async function searchPlacePH(q) {
  if (!q || !q.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ph&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function calculateFare(row, distance, minutes) {
  const base = parseFloat(row["Base Rate(First 5 or 4 kilometers)"]) || 0;
  const perKm = parseFloat(row["Rate per km (₱)"]) || 0;
  const perMin = parseFloat(row["Per Minute Travel time"]) || 0;

  let baseDistance = 5;
  if (row["Vehicle Type"] === "PUJ") baseDistance = 4;

  const extraDistance = Math.max(0, distance - baseDistance);

  return base + extraDistance * perKm + minutes * perMin;
}

const VEHICLE_TYPES = ["PUB", "PUJ", "Taxi", "TNVS", "UVE"];
const PUB_CATEGORIES = [
  { value: "PUB City", label: "PUB City" },
  { value: "PUB Provincial", label: "PUB Provincial" }
];

export default function ItineraryCostEstimation({ onClose }) {
  const [fares, setFares] = useState([]);
  const [vehicleType, setVehicleType] = useState("");
  const [pubCategory, setPubCategory] = useState("");
  const [subType, setSubType] = useState("");
  const [distance, setDistance] = useState(""); // will be set by route
  const [minutes, setMinutes] = useState(20);
  const [result, setResult] = useState(null);

  // Two search boxes
  const [fromQuery, setFromQuery] = useState("");
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [fromPlace, setFromPlace] = useState(null);
  const fromActiveIndex = useRef(-1);

  const [toQuery, setToQuery] = useState("");
  const [toSuggestions, setToSuggestions] = useState([]);
  const [toPlace, setToPlace] = useState(null);
  const toActiveIndex = useRef(-1);

  // Map refs
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const markerRefs = useRef({});
  const routeRef = useRef(null);

  useEffect(() => {
    Papa.parse(CSV_PATH, {
      header: true,
      download: true,
      complete: (results) => setFares(results.data),
    });
  }, []);

  // Helper to normalize vehicle type
  function normalizeType(type) {
    return type.replace(/\s+/g, " ").replace(/\n/g, " ").trim();
  }

  // Filter sub-types based on selected vehicle type and PUB category
  let subTypeOptions = [];
  if (vehicleType === "PUB" && pubCategory) {
    subTypeOptions = fares
      .filter(row => normalizeType(row["Vehicle Type"]) === pubCategory)
      .map(row => row["Sub-Type"])
      .filter((v, i, arr) => v && arr.indexOf(v) === i);
  } else if (vehicleType && vehicleType !== "PUB") {
    subTypeOptions = fares
      .filter(row => normalizeType(row["Vehicle Type"]) === vehicleType)
      .map(row => row["Sub-Type"])
      .filter((v, i, arr) => v && arr.indexOf(v) === i);
  }

  function handleEstimate() {
    let row;
    if (vehicleType === "PUB" && pubCategory) {
      row = fares.find(
        r => normalizeType(r["Vehicle Type"]) === pubCategory && r["Sub-Type"] === subType
      );
    } else {
      row = fares.find(
        r => normalizeType(r["Vehicle Type"]) === vehicleType && r["Sub-Type"] === subType
      );
    }
    if (row) {
      const price = calculateFare(row, distance, minutes);
      setResult({ ...row, price });
    } else {
      setResult(null);
    }
  }

  let discountedFare = null;
  if (result) {
    discountedFare = (result.price * 0.8).toFixed(2);
  }

  // Init map
  useEffect(() => {
    if (map) return;
    const m = L.map(mapRef.current, { zoomControl: true });
    // Start with a Taguig-focused preview; fallback to Metro Manila / Philippines if needed
    try {
      m.fitBounds(TAGUIG_BOUNDS, { padding: [40, 40] });
    } catch (e) {
      try {
        m.fitBounds(METRO_MANILA_BOUNDS, { padding: [40, 40] });
      } catch (err) {
        m.fitBounds(PHILIPPINES_BOUNDS);
      }
    }
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(m);
    setMap(m);
  }, [map]);

  // Place markers for from/to
  useEffect(() => {
    if (!map) return;

    // Remove old markers
    Object.values(markerRefs.current).forEach(marker => map.removeLayer(marker));
    markerRefs.current = {};

    const pinIcon = L.icon({
      iconUrl: `${process.env.PUBLIC_URL || ""}/placeholder.png`,
      iconSize: [40, 40],
      iconAnchor: [20, 38],
      popupAnchor: [0, -38],
    });

    if (fromPlace) {
      markerRefs.current.from = L.marker([Number(fromPlace.lat), Number(fromPlace.lon)], { icon: pinIcon })
        .addTo(map)
        .bindPopup("From: " + fromPlace.display_name)
        .openPopup();
    }
    if (toPlace) {
      markerRefs.current.to = L.marker([Number(toPlace.lat), Number(toPlace.lon)], { icon: pinIcon })
        .addTo(map)
        .bindPopup("To: " + toPlace.display_name)
        .openPopup();
    }
    // Fit bounds if both
    if (fromPlace && toPlace) {
      map.fitBounds([
        [Number(fromPlace.lat), Number(fromPlace.lon)],
        [Number(toPlace.lat), Number(toPlace.lon)],
      ], { padding: [40, 40] });
    }
  }, [map, fromPlace, toPlace]);

  // Routing and distance calculation
  useEffect(() => {
    if (!map || !fromPlace || !toPlace) return;

    // Remove previous route
    if (routeRef.current) {
      map.removeControl(routeRef.current);
      routeRef.current = null;
    }

    routeRef.current = L.Routing.control({
      waypoints: [
        L.latLng(Number(fromPlace.lat), Number(fromPlace.lon)),
        L.latLng(Number(toPlace.lat), Number(toPlace.lon)),
      ],
      router: L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
      }),
      show: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      lineOptions: { styles: [{ color: "#6c63ff", weight: 5 }] },
      createMarker: () => null,
    }).addTo(map);

    routeRef.current.on("routesfound", function (e) {
      const route = e.routes[0];
      if (route && route.summary) {
        setDistance((route.summary.totalDistance / 1000).toFixed(2));
      }
    });

    return () => {
      if (routeRef.current) {
        map.removeControl(routeRef.current);
        routeRef.current = null;
      }
    };
  }, [map, fromPlace, toPlace]);

  // Debounced search for "from"
  const fromDebounceTimer = useRef();
  const handleFromInput = (e) => {
    setFromQuery(e.target.value);
    setFromPlace(null);
    clearTimeout(fromDebounceTimer.current);
    const value = e.target.value;
    fromActiveIndex.current = -1;
    fromDebounceTimer.current = setTimeout(async () => {
      if (value.length > 0) {
        const res = await searchPlacePH(value);
        setFromSuggestions(res.slice(0, 8)); // limit suggestions
      } else {
        setFromSuggestions([]);
      }
    }, 400);
  };

  // Debounced search for "to"
  const toDebounceTimer = useRef();
  const handleToInput = (e) => {
    setToQuery(e.target.value);
    setToPlace(null);
    clearTimeout(toDebounceTimer.current);
    const value = e.target.value;
    toActiveIndex.current = -1;
    toDebounceTimer.current = setTimeout(async () => {
      if (value.length > 0) {
        const res = await searchPlacePH(value);
        setToSuggestions(res.slice(0, 8));
      } else {
        setToSuggestions([]);
      }
    }, 400);
  };

  // Select suggestion handlers
  const selectFromSuggestion = (s) => {
    setFromPlace(s);
    setFromQuery(s.display_name);
    setFromSuggestions([]);
    fromActiveIndex.current = -1;
  };
  const selectToSuggestion = (s) => {
    setToPlace(s);
    setToQuery(s.display_name);
    setToSuggestions([]);
    toActiveIndex.current = -1;
  };

  // keyboard navigation for suggestions
  const handleFromKeyDown = (e) => {
    if (!fromSuggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      fromActiveIndex.current = Math.min(fromActiveIndex.current + 1, fromSuggestions.length - 1);
      setFromQuery(fromSuggestions[fromActiveIndex.current].display_name);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      fromActiveIndex.current = Math.max(fromActiveIndex.current - 1, 0);
      setFromQuery(fromSuggestions[fromActiveIndex.current].display_name);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = fromSuggestions[fromActiveIndex.current] || fromSuggestions[0];
      if (sel) selectFromSuggestion(sel);
    } else if (e.key === "Escape") {
      setFromSuggestions([]);
      fromActiveIndex.current = -1;
    }
  };

  const handleToKeyDown = (e) => {
    if (!toSuggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      toActiveIndex.current = Math.min(toActiveIndex.current + 1, toSuggestions.length - 1);
      setToQuery(toSuggestions[toActiveIndex.current].display_name);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      toActiveIndex.current = Math.max(toActiveIndex.current - 1, 0);
      setToQuery(toSuggestions[toActiveIndex.current].display_name);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = toSuggestions[toActiveIndex.current] || toSuggestions[0];
      if (sel) selectToSuggestion(sel);
    } else if (e.key === "Escape") {
      setToSuggestions([]);
      toActiveIndex.current = -1;
    }
  };

  // Combined set destinations handler (keeps existing behavior)
  const handleSetDestinations = async () => {
    // Only set if a suggestion is selected, else search and pick first
    if (!fromPlace && fromQuery) {
      const res = await searchPlacePH(fromQuery);
      if (res.length) {
        setFromPlace(res[0]);
        setFromQuery(res[0].display_name);
        setFromSuggestions([]);
      }
    }
    if (!toPlace && toQuery) {
      const res = await searchPlacePH(toQuery);
      if (res.length) {
        setToPlace(res[0]);
        setToQuery(res[0].display_name);
        setToSuggestions([]);
      }
    }
  };

  // Only estimate if all required fields are filled
  useEffect(() => {
    if (
      vehicleType &&
      (vehicleType !== "PUB" || pubCategory) &&
      subType &&
      distance &&
      minutes
    ) {
      handleEstimate();
    } else {
      setResult(null);
    }
    // eslint-disable-next-line
  }, [vehicleType, pubCategory, subType, distance, minutes]);

  return (
    <div className="cost-backdrop hotels-backdrop">
      <div className="cost-modal">
        <div className="cost-header">
          <span className="cost-title">Itinerary Cost Estimation</span>
          <button className="cost-close" onClick={onClose}>&times;</button>
        </div>
        <div className="cost-location-group" style={{ display: "flex", gap: "16px", padding: "0 32px 12px 32px" }}>
          <div className="cost-label" style={{ flex: 1, position: "relative" }}>
            <label>From</label>
            <input
              className="cost-input"
              placeholder="Type a city/place in PH"
              value={fromQuery}
              onChange={handleFromInput}
              onKeyDown={handleFromKeyDown}
              autoComplete="new-password"
              aria-autocomplete="list"
              aria-controls="from-suggestions"
            />
            {fromSuggestions.length > 0 && (
              <ul id="from-suggestions" role="listbox" className="suggestions-list">
                {fromSuggestions.map((s, i) => (
                  <li
                    key={s.place_id || `${s.lat}-${s.lon}-${i}`}
                    role="option"
                    aria-selected={fromActiveIndex.current === i}
                    className={`suggestion-item ${fromActiveIndex.current === i ? "active" : ""}`}
                    onMouseDown={(ev) => { ev.preventDefault(); selectFromSuggestion(s); }} // use onMouseDown to avoid blur before click
                  >
                    <div className="suggestion-main">{s.display_name}</div>
                    <div className="suggestion-sub">{s.type || ""}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="cost-label" style={{ flex: 1, position: "relative" }}>
            <label>To</label>
            <input
              className="cost-input"
              placeholder="Type a city/place in PH"
              value={toQuery}
              onChange={handleToInput}
              onKeyDown={handleToKeyDown}
              autoComplete="new-password"
              aria-autocomplete="list"
              aria-controls="to-suggestions"
            />
            {toSuggestions.length > 0 && (
              <ul id="to-suggestions" role="listbox" className="suggestions-list">
                {toSuggestions.map((s, i) => (
                  <li
                    key={s.place_id || `${s.lat}-${s.lon}-${i}`}
                    role="option"
                    aria-selected={toActiveIndex.current === i}
                    className={`suggestion-item ${toActiveIndex.current === i ? "active" : ""}`}
                    onMouseDown={(ev) => { ev.preventDefault(); selectToSuggestion(s); }}
                  >
                    <div className="suggestion-main">{s.display_name}</div>
                    <div className="suggestion-sub">{s.type || ""}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div
          id="map"
          ref={mapRef}
          style={{
            width: "100%",
            height: "340px",
            borderRadius: 12,
            marginBottom: 8,
            background: "#eef2ff",
            boxShadow: "0 2px 8px rgba(108,99,255,0.08)",
          }}
        />
        <div className="cost-controls">
          <label className="hotels-label">
            Vehicle Type
            <select
              className="hotels-select"
              value={vehicleType}
              onChange={e => {
                setVehicleType(e.target.value);
                setPubCategory("");
                setSubType("");
              }}
            >
              <option value="">Select...</option>
              {VEHICLE_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {vehicleType === "PUB" && (
            <label className="hotels-label">
              PUB Category
              <select
                className="hotels-select"
                value={pubCategory}
                onChange={e => {
                  setPubCategory(e.target.value);
                  setSubType("");
                }}
              >
                <option value="">Select...</option>
                {PUB_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(vehicleType !== "" && (vehicleType !== "PUB" || pubCategory)) && (
            <label className="hotels-label">
              Sub-Type
              <select
                className="hotels-select"
                value={subType}
                onChange={e => setSubType(e.target.value)}
              >
                <option value="">Select...</option>
                {subTypeOptions.map((sub, i) => (
                  <option key={i} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="hotels-label">
            Distance (km)
            <input
              className="hotels-input"
              type="text"
              value={distance}
              onChange={e => setDistance(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Auto-filled from route"
              readOnly
            />
          </label>
          <label className="hotels-label">
            Travel Time (minutes)
            <input
              className="hotels-input"
              type="text"
              value={minutes}
              onChange={e => setMinutes(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Enter travel time in minutes"
            />
          </label>
        </div>
        <div className="cost-body">
          {result ? (
            <ul className="hotels-list">
              <li className="hotels-item">
                <div className="hotels-item-main">
                  <div className="hotels-name">
                    {vehicleType === "PUB" && pubCategory
                      ? `${pubCategory} - ${result["Sub-Type"]}`
                      : `${result["Vehicle Type"]} - ${result["Sub-Type"]}`}
                  </div>
                  <div className="hotels-meta">
                    Base Rate: ₱{result["Base Rate(First 5 or 4 kilometers)"]}
                    <span className="hotels-dot">•</span>
                    Rate/km: ₱{result["Rate per km (₱)"]}
                    <span className="hotels-dot">•</span>
                    Per Min: ₱{result["Per Minute Travel time"]}
                  </div>
                </div>
              </li>
            </ul>
          ) : (
            <div className="hotels-info">
              Enter all details to automatically see the fare.
            </div>
          )}
          {result && (
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "32px",
              padding: "12px 18px 0 18px",
              fontWeight: 700,
              fontSize: "1.18rem"
            }}>
              <span style={{ color: "#2563eb" }}>
                Regular Fare: ₱{result.price.toFixed(2)}
              </span>
              <span style={{ color: "#10b981" }}>
                Discounted Fare: ₱{discountedFare}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}