import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function ItineraryRouteCreateModal({ onClose }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [drawnRoute, setDrawnRoute] = useState([]);
  const polylineRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const m = L.map(mapRef.current).setView([14.55, 121.05], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(m);
    setMap(m);

    return () => m.remove();
  }, []);

  // Handle map clicks to add points
  useEffect(() => {
    if (!map) return;
    function onMapClick(e) {
      setDrawnRoute(route => [...route, [e.latlng.lng, e.latlng.lat]]);
    }
    map.on("click", onMapClick);
    return () => map.off("click", onMapClick);
  }, [map]);

  // Draw the polyline
  useEffect(() => {
    if (!map) return;
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    if (drawnRoute.length > 1) {
      polylineRef.current = L.polyline(drawnRoute.map(([lng, lat]) => [lat, lng]), { color: "blue", weight: 5 }).addTo(map);
      map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
    }
  }, [drawnRoute, map]);

  // Export as GeoJSON
  function handleExport() {
    if (drawnRoute.length < 2) return;
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: drawnRoute,
          },
        },
      ],
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "route.geojson";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    setDrawnRoute([]);
  }

  return (
    <div className="cost-backdrop" onClick={onClose}>
      <div className="cost-modal" onClick={e => e.stopPropagation()}>
        <div className="cost-header">
          <div className="cost-title">🗺️ Create & Export Route</div>
          <button className="cost-close" onClick={onClose}>×</button>
        </div>
        <div style={{ width: "100%", height: 500, marginBottom: 12 }} ref={mapRef} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleExport} disabled={drawnRoute.length < 2}>Export as GeoJSON</button>
          <button onClick={handleClear}>Clear</button>
        </div>
        <div style={{ marginTop: 10, fontSize: "0.95em" }}>
          Click on the map to add points. Double-click to finish. Export when ready.
        </div>
      </div>
    </div>
  );
}