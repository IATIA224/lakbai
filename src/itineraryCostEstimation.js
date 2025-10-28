import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import Papa from "papaparse";
import "./itineraryCostEstimation.css";
import { loadJeepneyRoutes, removeJeepneyRoutes } from "./itineraryjeeproute";
import polyline from "@mapbox/polyline";

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

// Only show these vehicle types
const VEHICLE_TYPES = [
  { value: "Taxi", label: "🚕 Taxi", description: "Metered taxi cabs" },
  { value: "TNVS", label: "🚗 Ride-hailing (TNVS)", description: "Grab, Uber-style services" },
  { value: "UVE", label: "🚙 UV Express", description: "Air-conditioned vans" }
];

// Helper: Find nearest point on jeepney routes
function findNearestRoutePoint(lat, lon, geojson) {
  let minDist = Infinity;
  let nearest = null;
  let routeIdx = -1;
  let segIdx = -1;

  if (!geojson) return null;

  geojson.features.forEach((feature, i) => {
    if (feature.geometry.type === "LineString") {
      feature.geometry.coordinates.forEach((coord, j) => {
        const [lng, lat2] = coord;
        const d = haversineDistance(
          { lat, lng: lon },
          { lat: lat2, lng }
        );
        if (d < minDist) {
          minDist = d;
          nearest = { lat: lat2, lng, routeIndex: i, pointIndex: j, feature };
          routeIdx = i;
          segIdx = j;
        }
      });
    }
  });

  return nearest;
}

// Helper: Find all routes that pass near a point (within threshold meters)
function findNearbyRoutes(lat, lon, geojson, threshold = 500) {
  if (!geojson) return [];
  const nearby = [];
  geojson.features.forEach((feature, i) => {
    if (feature.geometry.type === "LineString") {
      for (const coord of feature.geometry.coordinates) {
        const [lng, lat2] = coord;
        const d = haversineDistance({ lat, lng: lon }, { lat: lat2, lng });
        if (d < threshold) {
          nearby.push({ routeIndex: i, feature });
          break;
        }
      }
    }
  });
  return nearby;
}

const PUJ_FARE = {
  base: 13, // Base fare for first 4km
  perKm: 2.2, // Per km after base
  baseKm: 4,
};

function calculateJeepneyFare(distance) {
  if (distance <= PUJ_FARE.baseKm) return PUJ_FARE.base;
  return PUJ_FARE.base + (distance - PUJ_FARE.baseKm) * PUJ_FARE.perKm;
}

class PriorityQueue {
  constructor() {
    this.elements = [];
  }
  enqueue(element, priority) {
    this.elements.push({ element, priority });
    this.elements.sort((a, b) => a.priority - b.priority);
  }
  dequeue() {
    return this.elements.shift();
  }
  isEmpty() {
    return this.elements.length === 0;
  }
}

function findCommutePath(from, to, geojson) {
  const WALKING_SPEED = 5; // km/h
  const MAX_WALKING_DISTANCE = 1; // km
  const TRANSFER_PENALTY = 0.1; // Add a penalty for transfers (in hours)
  const NODE_INTERVAL = 5; // Create a node for every 5th point

  const startNode = { id: "start", lat: from.lat, lon: from.lon, type: "origin" };
  const endNode = { id: "end", lat: to.lat, lon: to.lon, type: "destination" };

  const nodes = new Map();
  nodes.set(startNode.id, startNode);
  nodes.set(endNode.id, endNode);

  const adj = new Map();
  adj.set(startNode.id, []);
  adj.set(endNode.id, []);

  geojson.features.forEach((route, routeIndex) => {
    for (let i = 0; i < route.geometry.coordinates.length; i += NODE_INTERVAL) {
      const coord = route.geometry.coordinates[i];
      const nodeId = `${routeIndex}-${i}`;
      const node = { id: nodeId, lat: coord[1], lon: coord[0], type: "jeep", routeIndex, pointIndex: i };
      nodes.set(nodeId, node);
      adj.set(nodeId, []);
    }
  });

  // Jeepney edges
  geojson.features.forEach((route, routeIndex) => {
    let prevNodeId = null;
    let accumulatedDist = 0;
    for (let i = 0; i < route.geometry.coordinates.length; i++) {
      if (i > 0) {
        const c1 = route.geometry.coordinates[i-1];
        const c2 = route.geometry.coordinates[i];
        accumulatedDist += haversineDistance({ lat: c1[1], lng: c1[0] }, { lat: c2[1], lng: c2[0] }) / 1000;
      }
      if (i % NODE_INTERVAL === 0) {
        const currentNodeId = `${routeIndex}-${i}`;
        if (prevNodeId) {
          adj.get(prevNodeId).push({ node: currentNodeId, weight: accumulatedDist / 20, mode: "jeep", distance: accumulatedDist, route });
          adj.get(currentNodeId).push({ node: prevNodeId, weight: accumulatedDist / 20, mode: "jeep", distance: accumulatedDist, route });
          accumulatedDist = 0;
        }
        prevNodeId = currentNodeId;
      }
    }
  });

  // Walking and transfer edges
  const allNodes = Array.from(nodes.values());
  for (let i = 0; i < allNodes.length; i++) {
    const n1 = allNodes[i];
    if (n1.type === 'origin') {
      for (let j = 0; j < allNodes.length; j++) {
        const n2 = allNodes[j];
        if (n2.type === 'jeep') {
          const dist = haversineDistance({ lat: n1.lat, lng: n1.lon }, { lat: n2.lat, lng: n2.lon }) / 1000;
          if (dist <= MAX_WALKING_DISTANCE) {
            adj.get(n1.id).push({ node: n2.id, weight: dist / WALKING_SPEED, mode: "walk", distance: dist });
          }
        }
      }
    } else if (n1.type === 'jeep') {
      for (let j = i + 1; j < allNodes.length; j++) {
        const n2 = allNodes[j];
        if (n2.type === 'jeep' && n1.routeIndex !== n2.routeIndex) {
          const dist = haversineDistance({ lat: n1.lat, lng: n1.lon }, { lat: n2.lat, lng: n2.lon }) / 1000;
          if (dist <= MAX_WALKING_DISTANCE) {
            adj.get(n1.id).push({ node: n2.id, weight: (dist / WALKING_SPEED) + TRANSFER_PENALTY, mode: "walk", distance: dist });
            adj.get(n2.id).push({ node: n1.id, weight: (dist / WALKING_SPEED) + TRANSFER_PENALTY, mode: "walk", distance: dist });
          }
        }
      }
       const distToEnd = haversineDistance({ lat: n1.lat, lng: n1.lon }, { lat: endNode.lat, lng: endNode.lon }) / 1000;
        if (distToEnd <= MAX_WALKING_DISTANCE) {
            adj.get(n1.id).push({ node: endNode.id, weight: distToEnd / WALKING_SPEED, mode: 'walk', distance: distToEnd });
        }
    }
  }

  // Dijkstra
  const distances = new Map();
  const previous = new Map();
  const pq = new PriorityQueue();

  nodes.forEach((node, nodeId) => {
    distances.set(nodeId, Infinity);
    previous.set(nodeId, null);
  });

  distances.set(startNode.id, 0);
  pq.enqueue(startNode.id, 0);

  while (!pq.isEmpty()) {
    const { element: u_id } = pq.dequeue();

    if (u_id === endNode.id) break;

    (adj.get(u_id) || []).forEach(edge => {
      const v_id = edge.node;
      const newDist = distances.get(u_id) + edge.weight;
      if (newDist < distances.get(v_id)) {
        distances.set(v_id, newDist);
        previous.set(v_id, { from: u_id, edge });
        pq.enqueue(v_id, newDist);
      }
    });
  }

  // Reconstruct path
  const path = [];
  let current = endNode.id;
  while (current && previous.get(current)) {
    const prev = previous.get(current);
    path.unshift({ ...prev.edge, from: nodes.get(prev.from), to: nodes.get(current) });
    current = prev.from;
  }

  return path;
}

const walkingIcon = L.icon({
  iconUrl: '/walking.png',
  iconSize: [32, 32],
});

const jeepIcon = L.icon({
  iconUrl: '/jeep.png',
  iconSize: [32, 32],
});

export default function ItineraryCostEstimationModal({ onClose }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const markerRefs = useRef({});
  const routeLineRef = useRef(null);

  const [fares, setFares] = useState([]);
  const [distance, setDistance] = useState("");
  const [minutes, setMinutes] = useState(20);


  const [fromQuery, setFromQuery] = useState("");
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [fromPlace, setFromPlace] = useState(null);
  const fromActiveIndex = useRef(-1);

  const [toQuery, setToQuery] = useState("");
  const [toSuggestions, setToSuggestions] = useState([]);
  const [toPlace, setToPlace] = useState(null);
  const toActiveIndex = useRef(-1);


  const [jeepneyRoutes, setJeepneyRoutes] = useState(null);

  // Debug: Show/hide jeepney routes
  const [showJeepneyRoutes, setShowJeepneyRoutes] = useState(false);



  // Commute route and fare (for possible transfers)
  const [commuteRoute, setCommuteRoute] = useState([]);
  const [commuteFare, setCommuteFare] = useState([]);

  useEffect(() => {
    Papa.parse(CSV_PATH, {
      header: true,
      download: true,
      complete: (results) => setFares(results.data),
    });
  }, []);

  useEffect(() => {
    fetch("/data/routes/jeeproute.json")
      .then(res => res.json())
      .then(data => {
        const geojsonData = {
          ...data,
          features: data.features.map(feature => {
            if (feature.properties && feature.properties.encodedPolyline) {
              const decodedPath = polyline.decode(feature.properties.encodedPolyline);
              return {
                ...feature,
                geometry: {
                  type: "LineString",
                  coordinates: decodedPath.map(c => [c[1], c[0]]) // polyline decode gives [lat, lon], geojson needs [lon, lat]
                }
              };
            }
            return feature;
          })
        };
        setJeepneyRoutes(geojsonData);
      });
  }, []);

  function normalizeType(type) {
    return type.replace(/\s+/g, " ").replace(/\n/g, " ").trim();
  }

  useEffect(() => {
    if (fromPlace && toPlace && jeepneyRoutes) {
      const path = findCommutePath(fromPlace, toPlace, jeepneyRoutes);

      const processedPath = [];
      if (path.length > 0) {
        let currentSegment = { ...path[0] };

        for (let i = 1; i < path.length; i++) {
          const nextSegment = path[i];
          if (
            nextSegment.mode === currentSegment.mode &&
            (nextSegment.mode === 'walk' || (nextSegment.mode === 'jeep' && nextSegment.route.properties.name === currentSegment.route.properties.name))
          ) {
            currentSegment.distance += nextSegment.distance;
            currentSegment.to = nextSegment.to;
          } else {
            processedPath.push(currentSegment);
            currentSegment = { ...nextSegment };
          }
        }
        processedPath.push(currentSegment);
      }
      setCommuteRoute(processedPath);

      const fareDetails = processedPath
        .filter(seg => seg.mode === 'jeep')
        .reduce((acc, seg) => {
          const routeName = seg.route.properties.name;
          if (!acc[routeName]) {
            acc[routeName] = { distance: 0, routeName };
          }
          acc[routeName].distance += seg.distance;
          return acc;
        }, {});

      const fares = Object.values(fareDetails).map(detail => ({
        ...detail,
        price: calculateJeepneyFare(detail.distance),
      }));
      setCommuteFare(fares);
    }
  }, [fromPlace, toPlace, jeepneyRoutes]);

  useEffect(() => {
    if (routeLineRef.current) {
      routeLineRef.current.forEach(layer => layer.remove());
    }
    routeLineRef.current = [];

    if (map && commuteRoute && commuteRoute.length > 0) {
      commuteRoute.forEach(segment => {
        let latLngs;
        const options = {
          weight: 8, // Make the line thicker
          opacity: 0.8,
        };

        let icon;
        let popupText = "";

        if (segment.mode === 'walk') {
          latLngs = [
            [segment.from.lat, segment.from.lon],
            [segment.to.lat, segment.to.lon]
          ];
          options.color = '#007bff';
          options.dashArray = '5, 10';
          icon = walkingIcon;
          popupText = "Walk";
        } else { // 'jeep'
          const route = segment.route;
          const fromIndex = segment.from.pointIndex;
          const toIndex = segment.to.pointIndex;

          if (route && fromIndex !== undefined && toIndex !== undefined) {
            const coords = route.geometry.coordinates.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1);
            latLngs = coords.map(c => [c[1], c[0]]); // GeoJSON is [lon, lat], Leaflet needs [lat, lon]
          } else {
            latLngs = [
              [segment.from.lat, segment.from.lon],
              [segment.to.lat, segment.to.lon]
            ];
          }
          options.color = '#000000'; // Make the route black
          icon = jeepIcon;
          popupText = `Ride ${segment.route.properties.name}`;
        }

        if (latLngs) {
            const polyline = L.polyline(latLngs, options).addTo(map);
            routeLineRef.current.push(polyline);

            const marker = L.marker([segment.from.lat, segment.from.lon], { icon }).addTo(map);
            marker.bindPopup(popupText);
            routeLineRef.current.push(marker);
        }
      });

      const lastSegment = commuteRoute[commuteRoute.length - 1];
      const endMarker = L.marker([lastSegment.to.lat, lastSegment.to.lon], { icon: walkingIcon }).addTo(map);
      endMarker.bindPopup("Destination");
      routeLineRef.current.push(endMarker);

      const bounds = L.latLngBounds(commuteRoute.flatMap(s => {
          if (s.mode === 'walk') {
              return [[s.from.lat, s.from.lon], [s.to.lat, s.to.lon]];
          }
          const route = s.route;
          const fromIndex = s.from.pointIndex;
          const toIndex = s.to.pointIndex;
          if (route && fromIndex !== undefined && toIndex !== undefined) {
            const coords = route.geometry.coordinates.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1);
            return coords.map(c => [c[1], c[0]]);
          }
          return [[s.from.lat, s.from.lon], [s.to.lat, s.to.lon]];
      }));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [map, commuteRoute]);

  useEffect(() => {
    if (!mapRef.current || mapRef.current._leaflet_id) return;

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
    } catch (error) {
      console.error("Map initialization error:", error);
    }

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  // Debug: Show/hide jeepney routes on map
  useEffect(() => {
    if (!map) return;
    // Remove old layer if exists
    if (map._jeepneyLayer) {
      map.removeLayer(map._jeepneyLayer);
      map._jeepneyLayer = null;
    }
    if (showJeepneyRoutes && jeepneyRoutes) {
      const jeepneyLayer = L.geoJSON(jeepneyRoutes, {
        style: feature => ({
          color: feature.properties?.color || "#e6194b",
          weight: 3,
          opacity: 0.7
        })
      }).addTo(map);
      map._jeepneyLayer = jeepneyLayer;
    }
  }, [map, jeepneyRoutes, showJeepneyRoutes]);







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

  const modalContent = (
    <div className="cost-backdrop" onClick={onClose}>
      <div className="cost-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cost-header">
          <div className="cost-title">🚗 Transportation Cost Estimator</div>
          <button className="cost-close" onClick={onClose}>×</button>
        </div>

        {/* Debug Button */}
        <div style={{marginBottom: 12, textAlign: "right"}}>
          <button
            style={{
              background: showJeepneyRoutes ? "#e6194b" : "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 16px",
              fontWeight: 600,
              cursor: "pointer"
            }}
            onClick={() => setShowJeepneyRoutes(v => !v)}
          >
            {showJeepneyRoutes ? "Hide Jeepney Routes" : "Show Jeepney Routes"}
          </button>
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

        {commuteRoute.length > 0 && (
          <div style={{margin: "16px 0"}}>
            <h4>Commute Route</h4>
            <ol>
              {commuteRoute.map((seg, i) => (
                <li key={i}>
                  {seg.mode === 'walk' ? (
                    <span>
                      🚶 Walk ({seg.distance.toFixed(2)} km)
                    </span>
                  ) : (
                    <span>
                      🚌 Ride <b>{seg.route.properties.name}</b> ({seg.distance.toFixed(2)} km)
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <div>
              <b>Total Fare:</b> ₱{commuteFare.reduce((sum, seg) => sum + seg.price, 0).toFixed(2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <>
      <div className="cost-backdrop" onClick={onClose}>
        <div className="cost-modal" onClick={e => e.stopPropagation()}>
          {modalContent}
        </div>
      </div>

    </>,
    document.body
  );
}

const NEAR_THRESHOLD_METERS = 50;
const GAP_TOLERANCE = 50;

// Clean up routing containers on every render
document.querySelectorAll('.leaflet-routing-container').forEach(el => el.remove());

function haversineDistance(a, b) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const aVal = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}