"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShape } from "@electric-sql/react";
import mapboxgl from "mapbox-gl";
import { Pause, Play } from "lucide-react";
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

const PLAYBACK_SPEEDS = [1, 10, 25, 50];

function formatElapsed(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function Map({
  runId,
  raceId,
  isPlanned,
  isEnded,
}: {
  runId: string;
  raceId?: string | null;
  isPlanned?: boolean;
  isEnded?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const initializedRef = useRef(false);
  const lastPlaybackFrameRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [playbackElapsedMs, setPlaybackElapsedMs] = useState<number | null>(
    null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const { data: allPoints } = useShape<PointRow>({
    url: `${window.location.origin}/api/sync/points?runId=${runId}`,
  });

  const points = useMemo(
    () =>
      [...allPoints].sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() -
          new Date(b.recorded_at).getTime(),
      ),
    [allPoints],
  );

  const firstPointTime = points[0]
    ? new Date(points[0].recorded_at).getTime()
    : 0;
  const lastPointTime = points[points.length - 1]
    ? new Date(points[points.length - 1].recorded_at).getTime()
    : firstPointTime;
  const durationMs = Math.max(0, lastPointTime - firstPointTime);
  const safePlaybackElapsedMs = Math.min(playbackElapsedMs ?? durationMs, durationMs);
  const canPlayback = !!isEnded && points.length > 1 && durationMs > 0;
  const isPlaybackAtEnd = safePlaybackElapsedMs >= durationMs;
  const playbackIsPlaying = canPlayback && isPlaying && !isPlaybackAtEnd;
  const durationSeconds = durationMs / 1000;
  const elapsedSeconds = safePlaybackElapsedMs / 1000;

  const playbackPointIndex = useMemo(() => {
    if (!isEnded || points.length === 0) return points.length - 1;

    const targetTime = firstPointTime + safePlaybackElapsedMs;
    const nextIndex = points.findIndex(
      (point) => new Date(point.recorded_at).getTime() > targetTime,
    );

    if (nextIndex === -1) return points.length - 1;
    return Math.max(0, nextIndex - 1);
  }, [firstPointTime, isEnded, points, safePlaybackElapsedMs]);

  const displayCoords = useMemo<[number, number, number][]>(() => {
    const toCoord = (point: PointRow): [number, number, number] => [
      Number(point.longitude),
      Number(point.latitude),
      point.altitude ? Number(point.altitude) : 0,
    ];

    if (!isEnded) {
      return points.map(toCoord);
    }

    if (points.length === 0) return [];
    return points.slice(0, playbackPointIndex + 1).map(toCoord);
  }, [isEnded, playbackPointIndex, points]);

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
      attributionControl: true,
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

      // Fetch race route if a race is associated with this run
      if (raceId) {
        fetch(`/api/races?id=${raceId}`)
          .then((res) => res.json())
          .then((races: { id: string; name: string; geojson: GeoJSON.FeatureCollection }[]) => {
            const bounds = new mapboxgl.LngLatBounds();

            races.forEach((race, i) => {
              const sourceId = `race-${i}`;
              map.addSource(sourceId, { type: "geojson", data: race.geojson });
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

              // Collect bounds from race coordinates
              for (const feature of race.geojson.features) {
                const geom = feature.geometry;
                if (geom.type === "LineString") {
                  for (const coord of (geom as GeoJSON.LineString).coordinates) {
                    bounds.extend([coord[0], coord[1]]);
                  }
                } else if (geom.type === "MultiLineString") {
                  for (const line of (geom as GeoJSON.MultiLineString).coordinates) {
                    for (const coord of line) {
                      bounds.extend([coord[0], coord[1]]);
                    }
                  }
                }
              }
            });

            // Center map on race route for planned runs
            if (isPlanned && !bounds.isEmpty()) {
              map.fitBounds(bounds, { padding: 60, pitch: 45 });
              initializedRef.current = true;
            }
          });
      }

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
  }, [token, raceId, isPlanned]);

  useEffect(() => {
    if (!playbackIsPlaying) return;

    lastPlaybackFrameRef.current = null;
    let frameId: number;

    const tick = (now: number) => {
      const lastFrame = lastPlaybackFrameRef.current ?? now;
      const delta = now - lastFrame;
      lastPlaybackFrameRef.current = now;

      setPlaybackElapsedMs((elapsed) => {
        const nextElapsed = Math.min(
          (elapsed ?? durationMs) + delta * playbackSpeed,
          durationMs,
        );
        return nextElapsed;
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [durationMs, playbackIsPlaying, playbackSpeed]);

  // Update map when points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || displayCoords.length === 0) return;

    const latestCoord = displayCoords[displayCoords.length - 1];
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
        geometry: { type: "LineString", coordinates: displayCoords },
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
    const windowSize = Math.min(30, displayCoords.length - 1);
    if (windowSize > 0) {
      const back = displayCoords[displayCoords.length - 1 - windowSize];
      const dx = latest[0] - back[0];
      const dy = latest[1] - back[1];
      bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
    }

    // Follow runner with 3D camera
    map.easeTo({
      center: latest,
      bearing,
      pitch: 60,
      duration: isEnded
        ? playbackIsPlaying
          ? Math.max(16, 2000 / playbackSpeed)
          : 250
        : 2000,
      easing: (t) => t,
    });
  }, [displayCoords, mapLoaded, isEnded, playbackIsPlaying, playbackSpeed]);

  return (
    <div className="relative flex-1 min-h-0 min-w-0">
      <div ref={containerRef} className="h-full w-full" />
      {canPlayback && (
        <div className="pointer-events-none absolute inset-x-2 bottom-6 z-30 lg:inset-x-4 lg:bottom-8">
          <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-1.5 rounded-md bg-background/90 p-2 backdrop-blur-sm sm:gap-3">
            <button
              type="button"
              onClick={() => {
                if (isPlaybackAtEnd) {
                  setPlaybackElapsedMs(0);
                }
                setIsPlaying((playing) => !playing);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              aria-label={playbackIsPlaying ? "Pause playback" : "Play playback"}
            >
              {playbackIsPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
                Replay
              </span>
              <input
                type="range"
                min={0}
                max={durationMs}
                step={250}
                value={safePlaybackElapsedMs}
                onChange={(event) => {
                  setIsPlaying(false);
                  setPlaybackElapsedMs(Number(event.target.value));
                }}
                className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
                aria-label="Playback timeline"
              />
              <span className="hidden w-20 text-right font-mono text-[10px] tabular-nums text-muted-foreground min-[430px]:inline sm:w-24">
                {formatElapsed(elapsedSeconds)} / {formatElapsed(durationSeconds)}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
                Speed
              </span>
              <div className="flex overflow-hidden rounded-md border border-border bg-background/80">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-1.5 py-1 font-mono text-[10px] tabular-nums transition-colors sm:px-2 ${
                      playbackSpeed === speed
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-pressed={playbackSpeed === speed}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
