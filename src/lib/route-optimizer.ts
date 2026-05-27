import { point, distance } from "@turf/turf";

export type Location = { lat: number; lng: number };

export type Stop = {
  orderId:  string;
  lat:      number | { toNumber(): number };
  lng:      number | { toNumber(): number };
  shopName: string;
};

export type OptimizeInput = {
  warehouse:   Location;
  stops:       Stop[];
  driverCount: number;
  mode:        "DISTANCE" | "TIME" | "BALANCED";
};

export type OptimizedRoute = {
  stops:            Stop[];
  totalDistanceKm:  number;
  estimatedMinutes: number;
};

function toNum(v: number | { toNumber(): number }): number {
  return typeof v === "number" ? v : v.toNumber();
}

function distKm(a: Location, b: Location): number {
  return distance(
    point([a.lng, a.lat]),
    point([b.lng, b.lat]),
    { units: "kilometers" }
  );
}

function stopToLoc(s: Stop): Location {
  return { lat: toNum(s.lat), lng: toNum(s.lng) };
}

// k-means++ initialisation + k-means iterations
function kMeansCluster(stops: Stop[], k: number): Stop[][] {
  if (stops.length <= k) return stops.map((s) => [s]);

  const locs = stops.map(stopToLoc);

  // k-means++ seed selection
  const centroids: Location[] = [locs[Math.floor(Math.random() * locs.length)]];
  while (centroids.length < k) {
    const weights = locs.map((l) =>
      Math.min(...centroids.map((c) => distKm(l, c) ** 2))
    );
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let selected = false;
    for (let i = 0; i < locs.length; i++) {
      r -= weights[i];
      if (r <= 0) { centroids.push(locs[i]); selected = true; break; }
    }
    // Fallback: floating-point rounding can exhaust r without triggering above
    if (!selected) centroids.push(locs[locs.length - 1]);
  }

  // Iterate k-means (20 passes is plenty for ≤50 stops)
  let clusters: Stop[][] = Array.from({ length: k }, () => []);
  for (let iter = 0; iter < 20; iter++) {
    clusters = Array.from({ length: k }, () => []);
    for (let si = 0; si < stops.length; si++) {
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let ci = 0; ci < centroids.length; ci++) {
        const d = distKm(locs[si], centroids[ci]);
        if (d < bestDist) { bestDist = d; bestIdx = ci; }
      }
      clusters[bestIdx].push(stops[si]);
    }
    // Recompute centroids
    for (let ci = 0; ci < k; ci++) {
      if (clusters[ci].length === 0) continue;
      centroids[ci] = {
        lat: clusters[ci].reduce((s, x) => s + toNum(x.lat), 0) / clusters[ci].length,
        lng: clusters[ci].reduce((s, x) => s + toNum(x.lng), 0) / clusters[ci].length,
      };
    }
  }

  return clusters.filter((c) => c.length > 0);
}

// Greedy nearest-neighbour ordering starting from a fixed origin
function nearestNeighbourOrder(origin: Location, stops: Stop[]): Stop[] {
  const remaining = [...stops];
  const ordered: Stop[] = [];
  let current = origin;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const d = distKm(current, stopToLoc(remaining[i]));
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    current = stopToLoc(next);
  }

  return ordered;
}

function calcRouteDist(origin: Location, stops: Stop[]): number {
  let total = 0;
  let current = origin;
  for (const s of stops) {
    const loc = stopToLoc(s);
    total += distKm(current, loc);
    current = loc;
  }
  total += distKm(current, origin); // return to warehouse
  return total;
}

// 2-opt: iteratively reverse sub-segments to reduce total distance
function twoOptImprove(origin: Location, stops: Stop[]): Stop[] {
  let best = [...stops];
  let bestDist = calcRouteDist(origin, best);
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const d = calcRouteDist(origin, candidate);
        if (d < bestDist - 0.001) { // epsilon to avoid floating-point cycling
          best = candidate;
          bestDist = d;
          improved = true;
        }
      }
    }
  }

  return best;
}

export function optimizeRoutes(input: OptimizeInput): OptimizedRoute[] {
  const { warehouse, stops, driverCount, mode } = input;

  const clusters = kMeansCluster(stops, driverCount);

  const routes: OptimizedRoute[] = clusters.map((cluster) => {
    let ordered = nearestNeighbourOrder(warehouse, cluster);
    // 2-opt is O(n²) per iteration — skip for large clusters to keep it fast
    if (ordered.length <= 20) {
      ordered = twoOptImprove(warehouse, ordered);
    }

    const km = calcRouteDist(warehouse, ordered);

    // Tashkent city speed: ~25 km/h = 2.4 min/km
    // TIME mode uses a slightly faster urban estimate (driver knows shortcuts)
    const minPerKm   = mode === "TIME" ? 2.0 : 2.4;
    const minPerStop = mode === "TIME" ? 4   : 5;
    const estimatedMinutes = Math.round(km * minPerKm + ordered.length * minPerStop);

    return {
      stops:            ordered,
      totalDistanceKm:  +km.toFixed(2),
      estimatedMinutes,
    };
  });

  // BALANCED: redistribute stops so no driver has >25% more stops than average
  if (mode === "BALANCED" && routes.length > 1) {
    const avg = stops.length / routes.length;
    const ceiling = Math.ceil(avg * 1.25);
    for (let i = 0; i < routes.length; i++) {
      while (routes[i].stops.length > ceiling) {
        // Move the last stop to the smallest route
        const smallest = routes.reduce(
          (min, r, idx) => (r.stops.length < routes[min].stops.length ? idx : min),
          0
        );
        const moved = routes[i].stops.pop()!;
        routes[smallest].stops.push(moved);
        // Re-order and recalc the affected routes
        routes[i].stops = nearestNeighbourOrder(warehouse, routes[i].stops);
        routes[smallest].stops = nearestNeighbourOrder(warehouse, routes[smallest].stops);
      }
    }
    // Recalculate distances after rebalance
    for (const r of routes) {
      const km = calcRouteDist(warehouse, r.stops);
      r.totalDistanceKm = +km.toFixed(2);
      r.estimatedMinutes = Math.round(km * 2.4 + r.stops.length * 5);
    }
  }

  return routes;
}
