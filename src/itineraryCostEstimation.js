import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import Papa from "papaparse";
import "./itineraryCostEstimation.css";

const CSV_PATH = "/data/transport/Fare_LTFRB.csv";

const PHILIPPINES_BOUNDS = [
  [4.5, 116.8],
  [21.3, 126.6],
];

const METRO_MANILA_BOUNDS = [
  [14.3, 120.8],
  [14.9, 121.3],
];

const TAGUIG_BOUNDS = [
  [14.52, 121.01],
  [14.60, 121.09],
];

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

// User-friendly vehicle type labels
const VEHICLE_TYPES = [
  { value: "PUB", label: "🚌 Bus (Public Utility Bus)", description: "Air-conditioned or non-aircon buses" },
  { value: "PUJ", label: "🚐 Jeepney (Public Utility Jeepney)", description: "Traditional and modern jeepneys" },
  { value: "Taxi", label: "🚕 Taxi", description: "Metered taxi cabs" },
  { value: "TNVS", label: "🚗 Ride-hailing (TNVS)", description: "Grab, Uber-style services" },
  { value: "UVE", label: "🚙 UV Express", description: "Air-conditioned vans" }
];

const PUB_CATEGORIES = [
  { value: "PUB City", label: "City Bus (Within Metro Manila/Cities)" },
  { value: "PUB Provincial", label: "Provincial Bus (Inter-city/Long distance)" }
];

export default function ItineraryCostEstimationModal({ onClose }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const markerRefs = useRef({});
  const routeRef = useRef(null);
  const mapInitialized = useRef(false);

  const [fares, setFares] = useState([]);
  const [vehicleType, setVehicleType] = useState("");
  const [pubCategory, setPubCategory] = useState("");
  const [subType, setSubType] = useState("");
  const [distance, setDistance] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [result, setResult] = useState(null);

  const [fromQuery, setFromQuery] = useState("");
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [fromPlace, setFromPlace] = useState(null);
  const fromActiveIndex = useRef(-1);

  const [toQuery, setToQuery] = useState("");
  const [toSuggestions, setToSuggestions] = useState([]);
  const [toPlace, setToPlace] = useState(null);
  const toActiveIndex = useRef(-1);

  useEffect(() => {
    Papa.parse(CSV_PATH, {
      header: true,
      download: true,
      complete: (results) => setFares(results.data),
    });
  }, []);

  function normalizeType(type) {
    return type.replace(/\s+/g, " ").replace(/\n/g, " ").trim();
  }

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

  useEffect(() => {
    if (!mapRef.current || mapInitialized.current) return;
    
    try {
      const m = L.map(mapRef.current, { zoomControl: true });
      
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
      mapInitialized.current = true;
    } catch (error) {
      console.error("Map initialization error:", error);
    }

    return () => {
      if (map) {
        map.remove();
        mapInitialized.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    Object.values(markerRefs.current).forEach(marker => {
      try {
        map.removeLayer(marker);
      } catch (e) {
        // Marker already removed
      }
    });
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
    if (fromPlace && toPlace) {
      map.fitBounds([
        [Number(fromPlace.lat), Number(fromPlace.lon)],
        [Number(toPlace.lat), Number(toPlace.lon)],
      ], { padding: [40, 40] });
    }
  }, [map, fromPlace, toPlace]);

  useEffect(() => {
    if (!map || !fromPlace || !toPlace) return;

    if (routeRef.current) {
      try {
        map.removeControl(routeRef.current);
      } catch (e) {
        // Control already removed
      }
      routeRef.current = null;
    }

    try {
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
    } catch (error) {
      console.error("Routing error:", error);
    }

    return () => {
      if (routeRef.current && map) {
        try {
          map.removeControl(routeRef.current);
        } catch (e) {
          // Control already removed
        }
        routeRef.current = null;
      }
    };
  }, [map, fromPlace, toPlace]);

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
        setFromSuggestions(res.slice(0, 8));
      } else {
        setFromSuggestions([]);
      }
    }, 400);
  };

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
  }, [vehicleType, pubCategory, subType, distance, minutes]);

  // Get the selected vehicle type object for display
  const selectedVehicle = VEHICLE_TYPES.find(v => v.value === vehicleType);

  const modalContent = (
    <div className="cost-backdrop" onClick={onClose}>
      <div className="cost-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cost-header">
          <div className="cost-title">🚗 Transportation Cost Estimator</div>
          <button className="cost-close" onClick={onClose}>×</button>
        </div>

        <div className="cost-controls">
          <div className="cost-location-group">
            <div className="cost-location-box">
              <label className="cost-label">
                From (Origin)
                <input
                  className="cost-input"
                  placeholder="Enter origin city..."
                  value={fromQuery}
                  onChange={handleFromInput}
                  onKeyDown={handleFromKeyDown}
                />
              </label>
              {fromSuggestions.length > 0 && (
                <ul className="cost-suggestions">
                  {fromSuggestions.map((s, i) => (
                    <li
                      key={i}
                      className={`cost-suggestion-item ${i === fromActiveIndex.current ? 'active' : ''}`}
                      onClick={() => selectFromSuggestion(s)}
                    >
                      {s.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="cost-location-box">
              <label className="cost-label">
                To (Destination)
                <input
                  className="cost-input"
                  placeholder="Enter destination city..."
                  value={toQuery}
                  onChange={handleToInput}
                  onKeyDown={handleToKeyDown}
                />
              </label>
              {toSuggestions.length > 0 && (
                <ul className="cost-suggestions">
                  {toSuggestions.map((s, i) => (
                    <li
                      key={i}
                      className={`cost-suggestion-item ${i === toActiveIndex.current ? 'active' : ''}`}
                      onClick={() => selectToSuggestion(s)}
                    >
                      {s.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="cost-grid">
            <label className="cost-label">
              Vehicle Type
              <select
                className="cost-select"
                value={vehicleType}
                onChange={(e) => {
                  setVehicleType(e.target.value);
                  setPubCategory("");
                  setSubType("");
                }}
              >
                <option value="">Select transportation...</option>
                {VEHICLE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>

            {vehicleType === "PUB" && (
              <label className="cost-label">
                Bus Type
                <select
                  className="cost-select"
                  value={pubCategory}
                  onChange={(e) => {
                    setPubCategory(e.target.value);
                    setSubType("");
                  }}
                >
                  <option value="">Select bus type...</option>
                  {PUB_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
            )}

            {subTypeOptions.length > 0 && (
              <label className="cost-label">
                {vehicleType === "PUB" ? "Bus Class" : 
                 vehicleType === "PUJ" ? "Jeepney Type" :
                 vehicleType === "Taxi" ? "Taxi Type" :
                 vehicleType === "TNVS" ? "Service Type" :
                 vehicleType === "UVE" ? "Van Type" : "Sub-Type"}
                <select
                  className="cost-select"
                  value={subType}
                  onChange={(e) => setSubType(e.target.value)}
                >
                  <option value="">Select option...</option>
                  {subTypeOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="cost-label">
              Travel Time (minutes)
              <input
                type="number"
                className="cost-input"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                min="1"
              />
            </label>

            {distance && (
              <label className="cost-label">
                Distance (km)
                <input
                  type="number"
                  className="cost-input"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </label>
            )}
          </div>

          {selectedVehicle && (
            <div style={{
              marginTop: "12px",
              padding: "12px 16px",
              background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
              borderRadius: "10px",
              border: "1px solid #c4b5fd",
              fontSize: "0.88rem",
              color: "#5b21b6",
              fontWeight: 500
            }}>
              ℹ️ {selectedVehicle.description}
            </div>
          )}
        </div>

        <div
          ref={mapRef}
          style={{
            width: "100%",
            height: "525px",
            borderRadius: "0px",
            marginBottom: "0px",
          }}
        />

        <div className="cost-body">
          {result ? (
            <>
              <div className="hotels-item" style={{ marginBottom: 0 }}>
                <div className="hotels-item-main">
                  <div className="hotels-name">
                    {vehicleType === "PUB" && pubCategory
                      ? `${pubCategory} - ${result["Sub-Type"]}`
                      : `${selectedVehicle?.label.split(" ")[1] || result["Vehicle Type"]} - ${result["Sub-Type"]}`}
                  </div>
                  <div className="hotels-meta">
                    Base Fare: ₱{result["Base Rate(First 5 or 4 kilometers)"]}
                    <span className="hotels-dot">•</span>
                    Per Kilometer: ₱{result["Rate per km (₱)"]}
                    <span className="hotels-dot">•</span>
                    Per Minute: ₱{result["Per Minute Travel time"]}
                  </div>
                </div>
              </div>
              <div className="cost-fare-summary">
                <div className="cost-fare-regular">
                  <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>Regular Fare</div>
                  <div>₱{result.price.toFixed(2)}</div>
                </div>
                <div className="cost-fare-discounted">
                  <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>Discounted Fare (PWD/Senior/Student)</div>
                  <div>₱{discountedFare}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="cost-info">
              {!fromPlace || !toPlace 
                ? "📍 Enter origin and destination to calculate route distance."
                : !vehicleType
                ? "🚗 Select a vehicle type to see fare estimates."
                : vehicleType === "PUB" && !pubCategory
                ? "🚌 Select bus type (City or Provincial)."
                : !subType
                ? `🎯 Select ${vehicleType === "PUB" ? "bus class" : "service type"} to see fare estimate.`
                : "✨ Enter all details to automatically calculate the fare."}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}