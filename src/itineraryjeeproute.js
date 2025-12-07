import L from "leaflet";

// Define a palette of colors for debugging
const DEBUG_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
  "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
];

/**
 * Load jeepney routes GeoJSON and add to the given Leaflet map.
 * Returns the created layer (or null on error).
 * geojsonPath defaults to public/data/routes/jeepney_routes_updated.geojson
 */
export async function loadJeepneyRoutes(map, geojsonPath = "/data/routes/jeepney_routes_updated.geojson") {
  if (!map) {
    console.error("loadJeepneyRoutes: map is required");
    return null;
  }
  try {
    const res = await fetch(geojsonPath);
    if (!res.ok) throw new Error("Failed to fetch geojson: " + res.status);
    const geo = await res.json();

    // Assign a unique route_id to each feature if not present
    if (geo && Array.isArray(geo.features)) {
      geo.features.forEach((feature, idx) => {
        if (!feature.properties) feature.properties = {};
        if (!feature.properties.route_id) {
          feature.properties.route_id = `route_${idx + 1}`;
        }
      });
    }

    // Assign a color to each feature for debugging
    let colorIndex = 0;
    const layer = L.geoJSON(geo, {
      style: (feature) => {
        // Pick color based on index, cycling if more features than colors
        const color = DEBUG_COLORS[colorIndex % DEBUG_COLORS.length];
        colorIndex++;
        return {
          color,
          weight: 3,
          opacity: 0.9,
        };
      },
      onEachFeature: (feature, lyr) => {
        const p = feature.properties || {};
        const title = p.route_name || p.name || p.Route || "Jeepney route";
        lyr.bindTooltip(title, { sticky: true, direction: "center" });

        lyr.on("click", () => {
          const html = Object.entries(p)
            .map(([k, v]) => `<div><strong>${k}:</strong> ${String(v)}</div>`)
            .join("");
          lyr.bindPopup(`<div style="max-width:320px">${html}</div>`, { maxHeight: 300 }).openPopup();
        });
      },
    }).addTo(map);

    // attempt to zoom to layer bounds
    try {
      const bounds = layer.getBounds();
      if (bounds && typeof bounds.isValid === "function" ? bounds.isValid() : true) {
        map.fitBounds(bounds.pad ? bounds.pad(0.05) : bounds);
      }
    } catch (e) { /* ignore */ }

    return layer;
  } catch (err) {
    console.error("loadJeepneyRoutes error:", err);
    return null;
  }
}

/** Remove layer safely from map */
export function removeJeepneyRoutes(map, layer) {
  try {
    if (map && layer && map.hasLayer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  } catch (e) {
    console.error("removeJeepneyRoutes error:", e);
  }
}

// Export displayed jeepney routes as GeoJSON
export function exportJeepneyRoutesGeoJSON(layer, filename = "jeepney_routes_export.geojson") {
  if (!layer) {
    alert("No jeepney routes layer to export.");
    return;
  }
  // Get GeoJSON from the layer
  const geojson = layer.toGeoJSON();

  // Fix coordinates: flatten any nested arrays and ensure [lng, lat] format
  geojson.features.forEach(f => {
    if (f.geometry && Array.isArray(f.geometry.coordinates)) {
      if (f.geometry.type === "LineString") {
        f.geometry.coordinates = f.geometry.coordinates.map(coord =>
          Array.isArray(coord) && coord.length === 2 && typeof coord[0] === "number"
            ? [coord[0], coord[1]]
            : coord.flat()
        );
      } else if (f.geometry.type === "MultiLineString") {
        f.geometry.coordinates = f.geometry.coordinates.map(line =>
          line.map(coord =>
            Array.isArray(coord) && coord.length === 2 && typeof coord[0] === "number"
              ? [coord[0], coord[1]]
              : coord.flat()
          )
        );
      }
    }
  });

  // Convert to pretty JSON string
  const dataStr = JSON.stringify(geojson, null, 2);
  // Create a blob and trigger download
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Add to default export
export default {
  loadJeepneyRoutes,
  removeJeepneyRoutes,
  exportJeepneyRoutesGeoJSON,
};