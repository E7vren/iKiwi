"use client";

import { Loader2, MapPin, Navigation, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface LocationValue {
  address: string;
  latitude: number;
  longitude: number;
}

interface Props {
  value: LocationValue | null;
  onChange: (v: LocationValue) => void;
  className?: string;
}

const TASHKENT = { lat: 41.2995, lng: 69.2401 };

export function ShopLocationForm({ value, onChange, className }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/suspicious/noExplicitAny: mapbox-gl dynamic import
  const mapInstance = useRef<any>(null);
  // biome-ignore lint/suspicious/noExplicitAny: mapbox-gl dynamic import
  const markerRef = useRef<any>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value?.address ?? "");
  const [suggestions, setSuggestions] = useState<Array<{ place_name: string; center: [number, number] }>>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !token || token.includes("your_mapbox")) return;
    // biome-ignore lint/suspicious/noExplicitAny: mapbox-gl dynamic import
    let map: any;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      mapboxgl.accessToken = token;
      const center = value
        ? [value.longitude, value.latitude]
        : [TASHKENT.lng, TASHKENT.lat];

      map = new mapboxgl.Map({
        container: mapRef.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center: center as [number, number],
        zoom: value ? 15 : 12,
      });

      mapInstance.current = map;

      // Draggable marker
      const marker = new mapboxgl.Marker({ draggable: true, color: "#2e7d32" })
        .setLngLat(center as [number, number])
        .addTo(map);

      markerRef.current = marker;

      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        reverseGeocode(lng, lat);
      });

      map.on("click", (e: any) => {
        const { lng, lat } = e.lngLat;
        marker.setLngLat([lng, lat]);
        reverseGeocode(lng, lat);
      });
    });

    return () => { map?.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function moveMarker(lng: number, lat: number) {
    markerRef.current?.setLngLat([lng, lat]);
    mapInstance.current?.flyTo({ center: [lng, lat], zoom: 15 });
  }

  async function reverseGeocode(lng: number, lat: number) {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=en`
      );
      const data = await res.json();
      const place = data.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setSearchQuery(place);
      onChange({ address: place, latitude: lat, longitude: lng });
    } catch {
      onChange({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, latitude: lat, longitude: lng });
    }
  }

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&language=en&limit=5`
      );
      const data = await res.json();
      setSuggestions(data.features ?? []);
      setSearchOpen(true);
    } catch { /* silent */ }
  }

  function selectSuggestion(s: { place_name: string; center: [number, number] }) {
    const [lng, lat] = s.center;
    setSearchQuery(s.place_name);
    setSuggestions([]);
    setSearchOpen(false);
    moveMarker(lng, lat);
    onChange({ address: s.place_name, latitude: lat, longitude: lng });
  }

  function handleGps() {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const { latitude, longitude } = pos.coords;
        moveMarker(longitude, latitude);
        reverseGeocode(longitude, latitude);
      },
      () => setGpsLoading(false)
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Location *</Label>

      {/* GPS button */}
      <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGps} disabled={gpsLoading}>
        {gpsLoading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Navigation className="h-4 w-4 text-primary" />}
        {gpsLoading ? "Detecting…" : "Use my current location"}
      </Button>

      {/* Address search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search address…"
          className="pl-9"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => suggestions.length > 0 && setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
        />
        {searchOpen && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: suggestion list is positional
                key={i}
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-start gap-2"
                onClick={() => selectSuggestion(s)}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                <span>{s.place_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full h-48 rounded-xl overflow-hidden border"
        style={{ minHeight: 192 }}
      />
      <p className="text-xs text-muted-foreground">Tap the map or drag the pin to fine-tune</p>
    </div>
  );
}
