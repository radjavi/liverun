"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

function parseGpx(xml: string): [number, number][] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const wpts = doc.querySelectorAll("wpt");
  const coords: [number, number][] = [];
  for (const wpt of wpts) {
    const lat = parseFloat(wpt.getAttribute("lat") ?? "0");
    const lon = parseFloat(wpt.getAttribute("lon") ?? "0");
    coords.push([lon, lat]);
  }
  return coords;
}

// Build cumulative distance table for constant-speed interpolation
function buildDistanceTable(coords: [number, number][]) {
  const distances = [0];
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][0] - coords[i - 1][0];
    const dy = coords[i][1] - coords[i - 1][1];
    distances.push(distances[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return distances;
}

// Get position at a given fraction (0-1) of total distance
function sampleAtDistance(
  coords: [number, number][],
  distances: number[],
  fraction: number
): { pos: [number, number]; segIndex: number } {
  const totalDist = distances[distances.length - 1];
  const target = fraction * totalDist;
  // Binary search for segment
  let lo = 0;
  let hi = distances.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (distances[mid] <= target) lo = mid;
    else hi = mid;
  }
  const segLen = distances[hi] - distances[lo];
  const t = segLen > 0 ? (target - distances[lo]) / segLen : 0;
  const from = coords[lo];
  const to = coords[hi];
  return {
    pos: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t],
    segIndex: lo,
  };
}

export default function DemoMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const animRef = useRef<number>(0);
  const [token, setToken] = useState<string | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setToken(data.mapboxToken));
    fetch("/cph-mara-run.gpx")
      .then((res) => res.text())
      .then((xml) => setRoute(parseGpx(xml)));
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token || !route || route.length === 0) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: route[0],
      zoom: 15,
      pitch: 60,
      bearing: 0,
      antialias: true,
      attributionControl: true,
      interactive: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      // Remove all text labels
      for (const layer of map.getStyle().layers || []) {
        if (layer.type === "symbol") {
          map.removeLayer(layer.id);
        }
      }

      // 3D buildings
      map.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": "#1e1e1e",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.7,
        },
      });

      // Route line
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [] },
          properties: {},
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#f97316",
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });

      // Runner marker
      const el = document.createElement("div");
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#f97316";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 8px rgba(249,115,22,0.6)";
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(route[0])
        .addTo(map);

      // Fit to route bounds flat, then set pitch
      const bounds = new mapboxgl.LngLatBounds();
      for (const coord of route) bounds.extend(coord);
      map.fitBounds(bounds, { padding: 40, pitch: 0, bearing: 0, duration: 0 });
      map.setZoom(map.getZoom() + 0.8);
      map.setPitch(60);
      setLoaded(true);

      // Distance-based animation for constant speed
      const r = route!;
      const distances = buildDistanceTable(r);
      const runDuration = 180_000; // full route in 180s
      const rotationDuration = 180_000;
      let startTime: number | null = null;
      let lastSegIndex = -1;
      const drawn: [number, number][] = [];

      function frame(ts: number) {
        if (!startTime) startTime = ts;
        const elapsed = ts - startTime;

        // Slowly rotate bearing
        map.setBearing((elapsed / rotationDuration) * 360);

        // Runner position at constant speed
        const runFraction = (elapsed % runDuration) / runDuration;
        const { pos, segIndex } = sampleAtDistance(r, distances, runFraction);

        marker.setLngLat(pos);

        // Reset drawn line on loop
        if (segIndex < lastSegIndex) {
          drawn.length = 0;
          lastSegIndex = -1;
        }

        // Add any new passed waypoints to drawn line
        while (lastSegIndex < segIndex) {
          lastSegIndex++;
          drawn.push(r[lastSegIndex]);
        }

        const source = map.getSource("route") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [...drawn, pos],
            },
            properties: {},
          });
        }

        animRef.current = requestAnimationFrame(frame);
      }

      animRef.current = requestAnimationFrame(frame);
    });

    return () => {
      cancelAnimationFrame(animRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token, route]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full transition-opacity duration-750 ease-in-out"
      style={{ opacity: loaded ? 1 : 0 }}
    />
  );
}
