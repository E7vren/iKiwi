"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ROUTE_COLORS = [
  "#2e7d32", "#1565c0", "#e65100", "#6a1b9a",
  "#c62828", "#00695c", "#f57f17", "#283593",
];
const WAREHOUSE = { lat: 41.3275, lng: 69.2348 };

function toNum(v: number | string | { toNumber(): number } | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  return v.toNumber();
}

interface Stop {
  id: string;
  sequence: number;
  status: string;
  order: { shop: { name: string; latitude: number | string | null; longitude: number | string | null } };
}

export interface RouteMapData {
  id: string;
  status: string;
  stops: Stop[];
  staff?: { fullName: string; vehicleType: string; currentLat?: number | null; currentLng?: number | null } | null;
  totalDistanceKm?: number | string | null;
  estimatedMinutes?: number | null;
}

interface Props {
  routes: RouteMapData[];
  selectedRouteId: string | null;
  showDrivers: boolean;
}

export function RouteMap({ routes, selectedRouteId, showDrivers }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const addedLayersRef = useRef<string[]>([]);
  const addedSourcesRef = useRef<string[]>([]);
  const markersRef = useRef<{ remove(): void }[]>([]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Init map
  useEffect(() => {
    if (!token || token.includes("your_mapbox")) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (!mapRef.current || mapInstanceRef.current) return;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [WAREHOUSE.lng, WAREHOUSE.lat],
        zoom: 11,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.on("load", () => setMapLoaded(true));
      mapInstanceRef.current = map;
    });

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mapInstanceRef.current as any)?.remove?.();
      mapInstanceRef.current = null;
      setMapLoaded(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Render routes whenever data or filter changes
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapInstanceRef.current as any;

      // Cleanup previous layers + sources + markers
      for (const id of addedLayersRef.current) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of addedSourcesRef.current) {
        if (map.getSource(id)) map.removeSource(id);
      }
      for (const m of markersRef.current) m.remove();
      addedLayersRef.current = [];
      addedSourcesRef.current = [];
      markersRef.current = [];

      const visibleRoutes = selectedRouteId
        ? routes.filter((r) => r.id === selectedRouteId)
        : routes;

      // Warehouse marker
      const whEl = document.createElement("div");
      whEl.innerHTML = `<div style="background:#fff;border:2px solid #374151;border-radius:8px;padding:4px 6px;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.2);cursor:default">📦</div>`;
      const whMarker = new mapboxgl.Marker({ element: whEl })
        .setLngLat([WAREHOUSE.lng, WAREHOUSE.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML("<b>iKiwi Warehouse</b>"))
        .addTo(map);
      markersRef.current.push(whMarker);

      for (let ri = 0; ri < visibleRoutes.length; ri++) {
        const route = visibleRoutes[ri];
        const color = ROUTE_COLORS[routes.indexOf(route) % ROUTE_COLORS.length];
        const completedStatuses = ["COMPLETED", "PARTIAL_RETURN", "FULL_RETURN", "SKIPPED"];

        // Build polyline: warehouse → stops in sequence → warehouse
        const coords: [number, number][] = [[WAREHOUSE.lng, WAREHOUSE.lat]];
        for (const stop of route.stops) {
          coords.push([toNum(stop.order.shop.longitude), toNum(stop.order.shop.latitude)]);
        }
        coords.push([WAREHOUSE.lng, WAREHOUSE.lat]);

        const sourceId = `route-source-${route.id}`;
        const layerId = `route-layer-${route.id}`;

        map.addSource(sourceId, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} },
        });
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": color,
            "line-width": route.status === "IN_PROGRESS" ? 4 : 3,
            "line-opacity": route.status === "CANCELLED" ? 0.3 : 0.85,
            "line-dasharray": route.status === "IN_PROGRESS" ? [1, 0] : [4, 2],
          },
        });
        addedSourcesRef.current.push(sourceId);
        addedLayersRef.current.push(layerId);

        // Stop markers
        for (const stop of route.stops) {
          const el = document.createElement("div");
          const done = completedStatuses.includes(stop.status);
          el.innerHTML = `<div style="
            width:28px;height:28px;border-radius:50%;
            background:${done ? "#6b7280" : color};
            border:2px solid white;
            color:white;font-weight:700;font-size:12px;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 6px rgba(0,0,0,.3);
            cursor:pointer;
          ">${stop.sequence}</div>`;

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([toNum(stop.order.shop.longitude), toNum(stop.order.shop.latitude)])
            .setPopup(
              new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
                `<div style="font-size:12px;padding:2px">
                  <b>Stop ${stop.sequence}: ${stop.order.shop.name}</b><br/>
                  <span style="color:#6b7280">${stop.status}</span>
                 </div>`
              )
            )
            .addTo(map);
          markersRef.current.push(marker);
        }

        // Driver marker (live position if available and showDrivers)
        if (showDrivers && route.staff?.currentLat && route.staff?.currentLng) {
          const dEl = document.createElement("div");
          const icon = route.staff.vehicleType === "MOTORCYCLE" ? "🏍️"
            : route.staff.vehicleType === "VAN" ? "🚐"
            : route.staff.vehicleType === "TRUCK" ? "🚚" : "🚗";
          dEl.innerHTML = `<div style="background:${color};border-radius:20px;padding:4px 8px;color:white;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.3);white-space:nowrap">
            ${icon} ${route.staff.fullName.split(" ")[0]}
          </div>`;
          const dMarker = new mapboxgl.Marker({ element: dEl })
            .setLngLat([route.staff.currentLng, route.staff.currentLat])
            .setPopup(
              new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
                `<b>${route.staff.fullName}</b><br/><span style="color:#6b7280">${icon} ${route.staff.vehicleType}</span>`
              )
            )
            .addTo(map);
          markersRef.current.push(dMarker);
        }
      }
    });
  }, [mapLoaded, routes, selectedRouteId, showDrivers]);

  if (!token || token.includes("your_mapbox")) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <div className="text-center p-8">
          <p className="text-4xl mb-3">🗺️</p>
          <p className="font-semibold text-gray-700">Map not configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add <code className="bg-gray-100 px-1 rounded text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> to .env.local
          </p>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className="h-full w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm" />;
}
