// Cross-valley elevation profiles for Furious Squirrels level design.
//
//   node tools/geo/valley-profile.mjs            -> research/valley-profile.json (+ a summary on stdout)
//
// Samples the USGS 3DEP DEM tiles that hsg-tub-rally fetched (see tools/geo/geo-lib.mjs for the path) along
// east-west transects across Bathhouse Row, and along the "battle line" from the West Mountain Drive viewpoint to
// the Hot Springs Mountain Tower. Level terrain is a stylized, horizontally compressed version of these profiles.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Dem, RAW, haversine, ft } from './geo-lib.mjs';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../research/valley-profile.json');
const dem = new Dem([
  { file: 'dem-west.tif', optional: true },
  { file: 'dem-east.tif', optional: true },
  { file: 'dem-downtown.tif', bbox: [-93.08, 34.495, -93.025, 34.535] },
]);

// Row latitudes from research/bathhouse-row-layout.md / block-puzzle OSM centroids.
const transects = [
  { id: 'north', label: 'North end (Superior / Hale, Arlington behind)', lat: 34.5147 },
  { id: 'middle', label: 'Middle (Maurice / Fordyce / Quapaw)', lat: 34.5135 },
  { id: 'south', label: 'South end (Ozark / Buckstaff / Lamar)', lat: 34.5123 },
  { id: 'tower', label: 'Through the Hot Springs Mountain Tower', lat: 34.5172 },
];
const W = -93.072, E = -93.036, STEP_M = 10;

function profile(lon0, lat0, lon1, lat1) {
  const L = haversine(lon0, lat0, lon1, lat1), n = Math.round(L / STEP_M), pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, lon = lon0 + (lon1 - lon0) * u, lat = lat0 + (lat1 - lat0) * u;
    pts.push({ d: Math.round(u * L), lon: +lon.toFixed(6), lat: +lat.toFixed(6), z: +dem.sample(lon, lat).toFixed(1) });
  }
  return { length: Math.round(L), pts };
}

function summarize(p, rowLon = -93.0535) {
  const pts = p.pts.filter((q) => Number.isFinite(q.z));
  const floor = pts.reduce((a, b) => (b.z < a.z ? b : a));
  const west = pts.filter((q) => q.lon < floor.lon).reduce((a, b) => (b.z > a.z ? b : a), floor);
  const east = pts.filter((q) => q.lon > floor.lon).reduce((a, b) => (b.z > a.z ? b : a), floor);
  const row = pts.reduce((a, b) => (Math.abs(b.lon - rowLon) < Math.abs(a.lon - rowLon) ? b : a));
  return {
    floor: { lon: floor.lon, z: floor.z, ft: Math.round(ft(floor.z)) },
    row: { lon: row.lon, z: row.z, ft: Math.round(ft(row.z)) },
    westHigh: { lon: west.lon, z: west.z, ft: Math.round(ft(west.z)), dFromFloor: Math.round(haversine(west.lon, west.lat, floor.lon, floor.lat)) },
    eastHigh: { lon: east.lon, z: east.z, ft: Math.round(ft(east.z)), dFromFloor: Math.round(haversine(east.lon, east.lat, floor.lon, floor.lat)) },
    ridgeGap: Math.round(haversine(west.lon, west.lat, east.lon, east.lat)),
  };
}

const out = { generated: new Date().toISOString(), source: 'USGS 3DEP DEM tiles fetched by hsg-tub-rally (public domain)', raw: RAW, stepM: STEP_M, transects: [] };
for (const t of transects) {
  const p = profile(W, t.lat, E, t.lat);
  out.transects.push({ ...t, ...summarize(p), length: p.length, pts: p.pts });
}
// Battle line: OSM viewpoint node 5999161833 on West Mountain Drive's lower switchback -> tower (OSM way 999440241).
// Extended 0.8x past the viewpoint (up West Mountain's east face) and 0.3x past the tower.
const V = [-93.05666, 34.51412], T = [-93.04633, 34.51719], dv = [T[0] - V[0], T[1] - V[1]];
const bl = profile(V[0] - 0.8 * dv[0], V[1] - 0.8 * dv[1], T[0] + 0.3 * dv[0], T[1] + 0.3 * dv[1]);
out.battleLine = { from: 'West Mountain Drive viewpoint (OSM node 5999161833)', to: 'Hot Springs Mountain Tower (OSM way 999440241)', length: bl.length, ...summarize(bl), pts: bl.pts };

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
for (const t of [...out.transects, { id: 'battle', label: 'viewpoint -> tower', ...out.battleLine }]) {
  console.log(`${t.id.padEnd(7)} floor ${t.floor.ft} ft @ ${t.floor.lon} | row ${t.row?.ft} ft | west high ${t.westHigh.ft} ft (${t.westHigh.dFromFloor} m W) | east high ${t.eastHigh.ft} ft (${t.eastHigh.dFromFloor} m E) | ridge gap ${t.ridgeGap} m`);
}
// Compact 20-point shape for each transect, in feet, for eyeballing.
for (const t of out.transects) {
  const k = Math.max(1, Math.floor(t.pts.length / 24));
  console.log(t.id.padEnd(7), t.pts.filter((_, i) => i % k === 0).map((q) => Math.round(ft(q.z))).join(' '));
}
{
  const p = out.battleLine.pts, k = Math.max(1, Math.floor(p.length / 30));
  console.log('battle d(m):z(ft)', p.filter((_, i) => i % k === 0).map((q) => q.d + ':' + Math.round(ft(q.z))).join(' '));
}
