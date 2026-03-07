"use client";

import { useEffect, useRef, useState } from "react";
import { useShape } from "@electric-sql/react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type PointRow = {
  id: string;
  run_id: string;
  latitude: string;
  longitude: string;
  altitude: string | null;
  heart_rate: string | null;
  pace: string | null;
  distance_meters: string | null;
  recorded_at: string;
  created_at: string;
};

export default function Map({ runId }: { runId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const initializedRef = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const { data: allPoints } = useShape<PointRow>({
    url: `${window.location.origin}/api/sync/points`,
  });

  const points = allPoints
    .filter((p) => p.run_id === runId)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

  // Fetch mapbox token at runtime
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setToken(data.mapboxToken));
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;

    mapboxgl.accessToken = token;

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [0, 0],
      zoom: 2,
      pitch: 60,
      bearing: 0,
      antialias: true,
      attributionControl: false,
    });

    mapRef.current.on("load", () => {
      const map = mapRef.current!;

      // 3D terrain
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.0 });

      // Dim map labels so race route stands out
      for (const layer of map.getStyle().layers || []) {
        if (layer.type === "symbol") {
          map.setPaintProperty(layer.id, "text-color", "#555555");
        }
      }

      // Fetch race routes and add as static underlay
      fetch("/api/races")
        .then((res) => res.json())
        .then((collections: GeoJSON.FeatureCollection[]) => {
          collections.forEach((geojson, i) => {
            const sourceId = `race-${i}`;
            map.addSource(sourceId, { type: "geojson", data: geojson });
            map.addLayer({
              id: `race-${i}-line`,
              type: "line",
              source: sourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": "#ffffff",
                "line-width": 3,
                "line-opacity": 0.5,
                "line-dasharray": [1, 2],
              },
            });
            map.addLayer({
              id: `race-${i}-arrows`,
              type: "symbol",
              source: sourceId,
              layout: {
                "symbol-placement": "line",
                "symbol-spacing": 100,
                "text-field": "▶",
                "text-size": 30,
                "text-rotation-alignment": "map",
                "text-keep-upright": false,
              },
              paint: {
                "text-color": "#ffffff",
                "text-opacity": 0.6,
              },
            });
          });
        });

      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#f97316", "line-width": 5, "line-opacity": 1 },
      });

      // 3D buildings
      const layers = map.getStyle().layers;
      const labelLayer = layers?.find(
        (l) => l.type === "symbol" && (l.layout as Record<string, unknown>)?.["text-field"]
      );
      map.addLayer(
        {
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
        },
        labelLayer?.id
      );

      setMapLoaded(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
  }, [token]);

  // Update map when points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || points.length === 0) return;

    const coords: [number, number, number][] = points.map((p) => [
      Number(p.longitude),
      Number(p.latitude),
      p.altitude ? Number(p.altitude) : 0,
    ]);

    const latestCoord = coords[coords.length - 1];
    const latest: [number, number] = [latestCoord[0], latestCoord[1]];

    // Center on first point received
    if (!initializedRef.current) {
      map.setCenter(latest);
      map.setZoom(16);
      map.setPitch(60);
      initializedRef.current = true;
    }

    // Update route line
    const source = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {},
      });
    }

    // Update or create runner marker
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#f97316";
      el.style.border = "2px solid white";

      markerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat(latest)
        .addTo(map);
    } else {
      markerRef.current.setLngLat(latest);
    }

    // Calculate bearing from a longer window to avoid jitter
    let bearing = map.getBearing();
    const windowSize = Math.min(30, coords.length - 1);
    if (windowSize > 0) {
      const back = coords[coords.length - 1 - windowSize];
      const dx = latest[0] - back[0];
      const dy = latest[1] - back[1];
      bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
    }

    // Follow runner with 3D camera
    map.easeTo({
      center: latest,
      bearing,
      pitch: 60,
      duration: 2000,
      easing: (t) => t,
    });
  }, [points, mapLoaded]);

  return (
    <>
<div ref={containerRef} className="flex-1 min-h-0" />
    </>
  );
}
