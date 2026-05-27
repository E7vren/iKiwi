"use client";

import { Navigation, Search, X } from "lucide-react";
import type mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Shop } from "@/types";

interface Props {
  shops: Shop[];
}

export function MapboxMap({ shops }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const filtered = shops.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase())
  );

  // Init map
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token.includes("your_mapbox")) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [69.2401, 41.2995],
        zoom: 11,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.on("load", () => setMapLoaded(true));

      mapInstanceRef.current = map;
      return () => map.remove();
    });
  }, []);

  // Add/update markers when shops change or map loads
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      // Remove old markers
      for (const m of markersRef.current) {
        m.remove();
      }

      markersRef.current = [];

      shops.forEach((shop) => {
        const el = document.createElement("div");
        el.className =
          "flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer transition-transform hover:scale-110";
        el.style.backgroundColor = shop.isActive ? "#16a34a" : "#9ca3af";
        el.innerHTML = `<span style="color:white;font-size:14px">🏪</span>`;
        el.title = shop.name;

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
          <div style="font-family:sans-serif;padding:4px;min-width:180px">
            <p style="font-weight:600;font-size:13px;margin:0 0 4px">${shop.name}</p>
            <p style="font-size:11px;color:#6b7280;margin:0 0 2px">${shop.ownerName}</p>
            <p style="font-size:11px;color:#6b7280;margin:0 0 8px">${shop.address}</p>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}"
               target="_blank" rel="noopener noreferrer"
               style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#16a34a;font-weight:500;text-decoration:none">
              Navigate ↗
            </a>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([shop.longitude, shop.latitude])
          .setPopup(popup)
          // biome-ignore lint/style/noNonNullAssertion: checked by mapLoaded guard above
          .addTo(mapInstanceRef.current!);

        el.addEventListener("click", () => setSelectedShop(shop));
        markersRef.current.push(marker);
      });
    });
  }, [mapLoaded, shops]);

  // Fly to selected shop
  useEffect(() => {
    if (!selectedShop || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({
      center: [selectedShop.longitude, selectedShop.latitude],
      zoom: 15,
      duration: 1200,
    });
  }, [selectedShop]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || token.includes("your_mapbox")) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <div className="text-center p-8">
          <p className="text-4xl mb-3">🗺️</p>
          <p className="font-semibold text-gray-700">Map not configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add <code className="bg-gray-100 px-1 rounded text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code>{" "}
            to .env.local
          </p>
          <p className="text-xs text-muted-foreground mt-2">Get a free token at mapbox.com</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Sidebar */}
      <div
        className={`absolute left-0 top-0 bottom-0 z-10 bg-white border-r flex flex-col transition-all duration-200 ${
          sidebarOpen ? "w-64" : "w-0"
        } overflow-hidden`}
      >
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold flex-1">Shops ({shops.length})</p>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              className="h-8 pl-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((shop) => (
            <button
              key={shop.id}
              type="button"
              className={`w-full text-left p-3 border-b hover:bg-gray-50 transition-colors ${
                selectedShop?.id === shop.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
              }`}
              onClick={() => setSelectedShop(shop)}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full shrink-0 ${shop.isActive ? "bg-green-500" : "bg-gray-300"}`}
                />
                <p className="text-xs font-medium truncate">{shop.name}</p>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5 ml-4">
                {shop.address}
              </p>
            </button>
          ))}
        </div>

        {/* Stats overlay */}
        <div className="p-3 border-t bg-gray-50">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-lg font-bold text-primary">
                {shops.filter((s) => s.isActive).length}
              </p>
              <p className="text-[10px] text-muted-foreground">Active</p>
            </div>
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <p className="text-lg font-bold text-amber-500">
                {shops.filter((s) => !s.isActive).length}
              </p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Map container */}
      <div ref={mapRef} className="flex-1 h-full" />

      {/* Toggle sidebar button */}
      {!sidebarOpen && (
        <button
          type="button"
          className="absolute left-3 top-3 z-10 bg-white rounded-lg shadow-md px-3 py-2 text-xs font-medium flex items-center gap-1.5 hover:bg-gray-50 border"
          onClick={() => setSidebarOpen(true)}
        >
          <Search className="h-3.5 w-3.5" /> Shops
          <Badge className="bg-primary text-primary-foreground text-[10px] ml-0.5">{shops.length}</Badge>
        </button>
      )}

      {/* Navigate button for selected shop */}
      {selectedShop && (
        <div className="absolute bottom-4 right-4 z-10">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${selectedShop.latitude},${selectedShop.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-lg">
              <Navigation className="h-4 w-4 mr-1.5" /> Navigate to {selectedShop.name}
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}
