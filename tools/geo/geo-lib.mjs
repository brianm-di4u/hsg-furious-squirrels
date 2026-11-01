// Zero-dependency geo helpers. Copied from games/Cart Racing/tools/geo/geo-lib.mjs (same author, MIT); RAW now points at
// that game's git-ignored DEM tiles (override with FS_GEO_RAW).
//
//   readTiff(buf)          single-band uncompressed float32 TIFF (strips or tiles, II or MM), as returned by the
//                          USGS 3DEP ImageServer exportImage call, plus its GeoTIFF extent when the tags are present.
//                          Adapted from repos/hsg-theme-park/tools/geo/geo-lib.mjs, itself adapted from
//                          games/fishing/tools/geo/bake.mjs (same author, MIT). Added here: Buffer input, type-12
//                          (double) tags, GeoTIFF ModelPixelScale/ModelTiepoint, noData handling.
//   Dem                    loads one or more DEM TIFFs and samples bilinear elevation (metres) at lon/lat,
//                          using the finest tile that covers the point.
//   project / unproject    local metric frame about the Bathhouse Row reference point.
//   haversine, lineLength  distances in metres.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const RAW = process.env.FS_GEO_RAW || path.resolve(ROOT, '..', 'Cart Racing', 'art-src', 'geo', 'raw');

// ---------------------------------------------------------------------------------------------------------------
// TIFF
// ---------------------------------------------------------------------------------------------------------------
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };

/**
 * Read a single-band, uncompressed, 32-bit float TIFF.
 * @param {Buffer|Uint8Array|string} input  file bytes (or a path, for convenience)
 * @returns {{w:number,h:number,data:Float32Array,tags:object,bbox:null|{west:number,south:number,east:number,north:number},pixel:null|{dx:number,dy:number}}}
 *   bbox is the outer edge of the edge pixels (pixel-is-area), read from the GeoTIFF tags when present.
 *   Values below -1e4 (the service's noData, typically -3.4e38) and NaN stay as NaN in `data`.
 */
export function readTiff(input) {
  const b = Buffer.isBuffer(input) ? input : typeof input === 'string' ? fs.readFileSync(input) : Buffer.from(input);
  const le = b[0] === 0x49;
  if (!(le || b[0] === 0x4d) || (le ? b.readUInt16LE(2) : b.readUInt16BE(2)) !== 42) throw new Error('not a classic TIFF');
  const u16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const f64 = (o) => (le ? b.readDoubleLE(o) : b.readDoubleBE(o));
  const f32 = (o) => (le ? b.readFloatLE(o) : b.readFloatBE(o));
  const ifd = u32(4), n = u16(ifd), tags = {};
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12, tag = u16(o), type = u16(o + 2), cnt = u32(o + 4);
    const size = TYPE_SIZE[type] || 4, at = cnt * size > 4 ? u32(o + 8) : o + 8;
    if (type === 2) { tags[tag] = b.toString('latin1', at, at + cnt).replace(/\0+$/, ''); continue; }
    const vals = [];
    for (let k = 0; k < cnt; k++) {
      const p = at + k * size;
      vals.push(type === 3 ? u16(p) : type === 4 ? u32(p) : type === 12 ? f64(p) : type === 11 ? f32(p) : type === 1 ? b[p] : u32(p));
    }
    tags[tag] = vals;
  }
  const w = tags[256][0], h = tags[257][0];
  if (tags[259] && tags[259][0] !== 1) throw new Error('compressed TIFF (compression=' + tags[259][0] + ')');
  if (tags[258] && tags[258][0] !== 32) throw new Error('expected 32-bit samples, got ' + tags[258][0]);
  if (tags[339] && tags[339][0] !== 3) throw new Error('expected IEEE float samples (SampleFormat 3)');
  if (tags[277] && tags[277][0] !== 1) throw new Error('expected one band');
  const out = new Float32Array(w * h);
  if (tags[273]) {
    // Strips. Read exactly w*h floats: some 3DEP outputs (format=bip) carry a trailer after the raster,
    // and strip byte counts can be padded, so never trust the file length.
    let k = 0;
    for (let i = 0; i < tags[273].length && k < w * h; i++) {
      const off = tags[273][i], len = tags[279] ? tags[279][i] : (w * h - k) * 4;
      for (let p = 0; p < len && k < w * h; p += 4) out[k++] = f32(off + p);
    }
  } else {
    // Tiles (the exportImage TIFF is tiled 128x128; edge tiles are padded).
    const tw = tags[322][0], th = tags[323][0], across = Math.ceil(w / tw);
    tags[324].forEach((off, t) => {
      const tx = (t % across) * tw, ty = Math.floor(t / across) * th;
      for (let y = 0; y < th; y++) {
        const Y = ty + y; if (Y >= h) break;
        for (let x = 0; x < tw; x++) { const X = tx + x; if (X < w) out[Y * w + X] = f32(off + (y * tw + x) * 4); }
      }
    });
  }
  for (let i = 0; i < out.length; i++) if (!(out[i] > -1e4)) out[i] = NaN;
  let bbox = null, pixel = null;
  if (tags[33550] && tags[33922]) {
    // ModelPixelScale (sx, sy, sz) and ModelTiepoint (i, j, k, X, Y, Z): raster (i,j) <-> model (X,Y).
    // GTRasterTypeGeoKey: 1 = PixelIsArea (tiepoint at the pixel's outer corner), 2 = PixelIsPoint (centre).
    const [sx, sy] = tags[33550], [ti, tj, , X, Y] = tags[33922];
    let isPoint = false;
    const keys = tags[34735];
    if (keys) for (let k = 4; k + 3 < keys.length; k += 4) if (keys[k] === 1025) isPoint = keys[k + 3] === 2;
    const west = X - ti * sx - (isPoint ? sx / 2 : 0), north = Y + tj * sy + (isPoint ? sy / 2 : 0);
    bbox = { west, north, east: west + w * sx, south: north - h * sy };
    pixel = { dx: sx, dy: sy };
  }
  return { w, h, data: out, tags, bbox, pixel };
}

// ---------------------------------------------------------------------------------------------------------------
// Local metric projection
// ---------------------------------------------------------------------------------------------------------------
// Origin: the Bathhouse Row reference point (NRHP district point 34.513889, -93.053611, rounded), the origin used by
// research/bathhouse-row-layout.md. Equirectangular about the origin with WGS84 metres-per-degree at lat0.
// x = metres EAST, z = metres SOUTH (so -z is north): a right-handed Y-up three.js world.
// Over the 14 km x 7 km race area the scale error of this flat projection is < 0.1% (about 4 m at the far
// western edge, mostly in x because cos(lat) changes with lat).
export const ORIGIN = { lon: -93.0536, lat: 34.5139 };
const phi0 = (ORIGIN.lat * Math.PI) / 180;
export const M_PER_DEG_LAT = 111132.92 - 559.82 * Math.cos(2 * phi0) + 1.175 * Math.cos(4 * phi0) - 0.0023 * Math.cos(6 * phi0);
export const M_PER_DEG_LON = 111412.84 * Math.cos(phi0) - 93.5 * Math.cos(3 * phi0) + 0.118 * Math.cos(5 * phi0);

export function project(lon, lat) {
  return { x: (lon - ORIGIN.lon) * M_PER_DEG_LON, z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT };
}
export function unproject(x, z) {
  return { lon: ORIGIN.lon + x / M_PER_DEG_LON, lat: ORIGIN.lat - z / M_PER_DEG_LAT };
}

const R_EARTH = 6371008.8;
export function haversine(lon1, lat1, lon2, lat2) {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}
/** Length in metres of [{lon,lat}] or [[lon,lat]] polyline. */
export function lineLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], c = pts[i];
    L += Array.isArray(a) ? haversine(a[0], a[1], c[0], c[1]) : haversine(a.lon, a.lat, c.lon, c.lat);
  }
  return L;
}

// ---------------------------------------------------------------------------------------------------------------
// DEM
// ---------------------------------------------------------------------------------------------------------------
/**
 * new Dem([{ file, bbox? }]) where bbox = {west,south,east,north} or [west,south,east,north].
 * The GeoTIFF extent inside the file wins over a supplied bbox (the 3DEP service silently widens the requested
 * extent to keep pixels square in degrees: games/trivia's dem-downtown.tif asked for 34.495-34.535 but holds
 * 34.4909-34.5391). Tiles are tried finest-first; a tile is used when the point and its 2x2 bilinear
 * neighbourhood are inside it and finite.
 */
export class Dem {
  constructor(specs) {
    this.tiles = [];
    for (const s of specs) {
      const file = path.isAbsolute(s.file) ? s.file : path.join(RAW, s.file);
      if (!fs.existsSync(file)) { if (s.optional) continue; throw new Error('missing DEM ' + file); }
      const t = readTiff(fs.readFileSync(file));
      let bb = t.bbox;
      if (!bb && s.bbox) bb = Array.isArray(s.bbox) ? { west: s.bbox[0], south: s.bbox[1], east: s.bbox[2], north: s.bbox[3] } : s.bbox;
      if (!bb) throw new Error('no extent for ' + file);
      const dx = (bb.east - bb.west) / t.w, dy = (bb.north - bb.south) / t.h;
      const mx = dx * M_PER_DEG_LON, my = dy * M_PER_DEG_LAT;
      this.tiles.push({ name: path.basename(file), w: t.w, h: t.h, data: t.data, bbox: bb, dx, dy, mx, my, res: Math.sqrt(mx * my) });
    }
    this.tiles.sort((a, b) => a.res - b.res);
  }
  /** Which tile (finest first) would serve the point, or null. */
  tileFor(lon, lat) {
    for (const t of this.tiles) if (this._px(t, lon, lat)) return t;
    return null;
  }
  _px(t, lon, lat) {
    const fx = (lon - t.bbox.west) / t.dx - 0.5, fy = (t.bbox.north - lat) / t.dy - 0.5; // pixel centres
    if (fx < 0 || fy < 0 || fx > t.w - 1 || fy > t.h - 1) return null;
    const x0 = Math.min(Math.floor(fx), t.w - 2), y0 = Math.min(Math.floor(fy), t.h - 2);
    const i = y0 * t.w + x0, d = t.data;
    const a = d[i], b = d[i + 1], c = d[i + t.w], e = d[i + t.w + 1];
    if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(e))) return null;
    const u = fx - x0, v = fy - y0;
    return { z: (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v };
  }
  /** Bilinear elevation in metres (NAVD88, per 3DEP) at lon/lat, or NaN outside every tile. */
  sample(lon, lat) {
    for (const t of this.tiles) { const r = this._px(t, lon, lat); if (r) return r.z; }
    return NaN;
  }
  /** Same, plus the tile name used. */
  sampleInfo(lon, lat) {
    for (const t of this.tiles) { const r = this._px(t, lon, lat); if (r) return { z: r.z, tile: t.name, res: t.res }; }
    return { z: NaN, tile: null, res: NaN };
  }
  describe() {
    return this.tiles.map((t) => ({ name: t.name, w: t.w, h: t.h, bbox: t.bbox, pixelDeg: [t.dx, t.dy], pixelM: [+t.mx.toFixed(3), +t.my.toFixed(3)] }));
  }
}

/** The DEM set used by the race tools, finest first after sorting. Missing optional files are skipped. */
export function loadDefaultDem() {
  return new Dem([
    { file: 'dem-east.tif' },
    { file: 'dem-west.tif' },
    { file: 'dem-downtown.tif', bbox: [-93.08, 34.495, -93.025, 34.535] }, // file's own GeoTIFF extent overrides
    { file: 'dem-region.tif', bbox: [-93.3, 34.38, -92.85, 34.66] },
  ]);
}

export const ft = (m) => m / 0.3048;
