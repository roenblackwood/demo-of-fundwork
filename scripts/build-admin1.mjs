/**
 * Build public/maps/admin1/{countryId}.json from Natural Earth admin-1 (10m).
 * Run by hand. It is not part of the Next.js build.
 *
 *   node scripts/build-admin1.mjs
 *
 * Source file: ADMIN1_SRC, or /tmp/ne_10m_admin_1_states_provinces.geojson.
 * Each open, limited, and not-checked country is simplified to 60 KB or less.
 * Non-Jamaica cities in data/seed.json get an admin1Id from point-in-polygon.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = process.env.ADMIN1_SRC || "/tmp/ne_10m_admin_1_states_provinces.geojson";
const outDir = join(root, "public/maps/admin1");
const maxBytes = 60 * 1024;

const ISO = {
  jamaica: "JM",
  "dominican-republic": "DO",
  barbados: "BB",
  "el-salvador": "SV",
  colombia: "CO",
  mexico: "MX",
  kenya: "KE",
  ghana: "GH",
  rwanda: "RW",
  india: "IN",
  indonesia: "ID",
  philippines: "PH",
  brazil: "BR",
  nigeria: "NG",
  vietnam: "VN",
  pakistan: "PK",
  jordan: "JO",
  moldova: "MD",
  romania: "RO",
  ukraine: "UA",
};

const JAMAICA = {
  "Saint Ann": "st-ann",
  Trelawny: "trelawny",
  "Saint James": "st-james",
  Hanover: "hanover",
  Westmoreland: "westmoreland",
  "Saint Elizabeth": "st-elizabeth",
  Manchester: "manchester",
  Clarendon: "clarendon",
  "Saint Catherine": "st-catherine",
  "Saint Andrew": "st-andrew",
  Kingston: "kingston",
  "Saint Thomas": "st-thomas",
  Portland: "portland",
  "Saint Mary": "st-mary",
};

function slug(name) {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "area";
}

function uniqueId(name, used) {
  const base = slug(name);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  const id = `${base}-${n}`;
  used.add(id);
  return id;
}

function cleanGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") return geometry;
  if (geometry.type === "GeometryCollection") {
    const polygons = (geometry.geometries ?? []).filter(
      (item) => item.type === "Polygon" || item.type === "MultiPolygon",
    );
    if (polygons.length === 0) return null;
    if (polygons.length === 1) return polygons[0];
    const coordinates = [];
    for (const polygon of polygons) {
      if (polygon.type === "Polygon") coordinates.push(polygon.coordinates);
      else coordinates.push(...polygon.coordinates);
    }
    return { type: "MultiPolygon", coordinates };
  }
  return null;
}

function walkCoords(geometry, visit) {
  const step = (node) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number") {
      visit(node[0], node[1]);
      return;
    }
    for (const child of node) step(child);
  };
  step(geometry.coordinates);
}

function ringContains(ring, lng, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonContains(coordinates, lng, lat) {
  if (!ringContains(coordinates[0], lng, lat)) return false;
  for (let i = 1; i < coordinates.length; i += 1) {
    if (ringContains(coordinates[i], lng, lat)) return false;
  }
  return true;
}

function featureContains(feature, lng, lat) {
  const geometry = feature.geometry;
  if (!geometry) return false;
  if (geometry.type === "Polygon") return polygonContains(geometry.coordinates, lng, lat);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => polygonContains(polygon, lng, lat));
  }
  return false;
}

function nearestFeature(features, lng, lat) {
  let best = null;
  let bestDistance = Infinity;
  for (const feature of features) {
    walkCoords(feature.geometry, (x, y) => {
      const distance = (x - lng) ** 2 + (y - lat) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = feature;
      }
    });
  }
  return best;
}

function boundsOf(features) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const feature of features) {
    walkCoords(feature.geometry, (lng, lat) => {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    });
  }
  return {
    west: Number(west.toFixed(4)),
    south: Number(south.toFixed(4)),
    east: Number(east.toFixed(4)),
    north: Number(north.toFixed(4)),
  };
}

function centroid(feature) {
  let count = 0;
  let lng = 0;
  let lat = 0;
  const geometry = feature.geometry;
  const ring =
    geometry.type === "Polygon"
      ? geometry.coordinates[0]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates[0][0]
        : [];
  for (const pair of ring) {
    lng += pair[0];
    lat += pair[1];
    count += 1;
  }
  if (count === 0) return { lat: 0, lng: 0 };
  return { lat: Number((lat / count).toFixed(4)), lng: Number((lng / count).toFixed(4)) };
}

function simplify(input, output) {
  const tries = [
    ["30%", "0.001"],
    ["12%", "0.001"],
    ["6%", "0.01"],
    ["3%", "0.01"],
    ["1%", "0.02"],
    ["0.4%", "0.05"],
    ["0.15%", "0.08"],
    ["0.05%", "0.12"],
  ];
  let last = "";
  for (const [percent, precision] of tries) {
    const run = spawnSync(
      "npx",
      [
        "--yes",
        "mapshaper",
        input,
        "-simplify",
        "visvalingam",
        percent,
        "keep-shapes",
        "-o",
        "format=geojson",
        `precision=${precision}`,
        output,
        "force",
      ],
      { encoding: "utf8" },
    );
    if (run.status !== 0) {
      throw new Error(run.stderr || run.stdout || `mapshaper failed for ${input}`);
    }
    const size = statSync(output).size;
    last = `${percent} ${precision} ${size}`;
    if (size <= maxBytes) return size;
  }
  throw new Error(`${output} is still over 60 KB after ${last}`);
}

const countries = JSON.parse(readFileSync(join(root, "data/countries.json"), "utf8"));
const wanted = countries.filter((country) => country.status === "open" || country.status === "limited" || country.status === "not-checked");
const raw = JSON.parse(readFileSync(sourcePath, "utf8"));
const byIso = new Map();
for (const feature of raw.features ?? []) {
  const iso = feature.properties?.iso_a2;
  if (!iso) continue;
  const list = byIso.get(iso) ?? [];
  list.push(feature);
  byIso.set(iso, list);
}

mkdirSync(outDir, { recursive: true });
const bounds = {};
const names = [];
const collections = new Map();

for (const country of wanted) {
  const iso = ISO[country.id];
  if (!iso) throw new Error(`No ISO code for ${country.id}.`);
  const sourceFeatures = byIso.get(iso) ?? [];
  if (sourceFeatures.length === 0) {
    throw new Error(`${country.name} has no admin-1 features. Add an admin-0 fallback before shipping.`);
  }
  const used = new Set();
  const features = [];
  for (const feature of sourceFeatures) {
    const geometry = cleanGeometry(feature.geometry);
    if (!geometry) continue;
    const sourceName = feature.properties?.name_en || feature.properties?.name || "Area";
    let id;
    if (country.id === "jamaica") {
      id = JAMAICA[sourceName];
      if (!id) throw new Error(`Jamaica parish "${sourceName}" has no id.`);
      if (used.has(id)) throw new Error(`Duplicate Jamaica id ${id}.`);
      used.add(id);
    } else {
      id = uniqueId(sourceName, used);
    }
    features.push({
      type: "Feature",
      properties: { id, name: sourceName, countryId: country.id },
      geometry,
    });
  }
  if (country.id === "jamaica") {
    for (const id of Object.values(JAMAICA)) {
      if (!used.has(id)) throw new Error(`Jamaica is missing ${id}.`);
    }
  }
  const draft = join("/tmp", `fw-admin1-${country.id}.json`);
  const rough = join("/tmp", `fw-admin1-${country.id}-out.json`);
  writeFileSync(draft, JSON.stringify({ type: "FeatureCollection", features }));
  const size = simplify(draft, rough);
  const simplified = JSON.parse(readFileSync(rough, "utf8"));
  const cleaned = {
    type: "FeatureCollection",
    features: (simplified.features ?? []).map((feature) => ({
      type: "Feature",
      properties: {
        id: String(feature.properties?.id ?? ""),
        name: String(feature.properties?.name ?? ""),
        countryId: country.id,
      },
      geometry: feature.geometry,
    })),
  };
  if (cleaned.features.some((feature) => !feature.properties.id || !feature.properties.name)) {
    throw new Error(`${country.id} lost a name while simplifying.`);
  }
  const file = join(outDir, `${country.id}.json`);
  const body = JSON.stringify(cleaned);
  writeFileSync(file, body);
  const written = statSync(file).size;
  if (written > maxBytes) throw new Error(`${country.id} is ${written} bytes.`);
  bounds[country.id] = boundsOf(cleaned.features);
  collections.set(country.id, cleaned);
  for (const feature of cleaned.features) {
    const point = centroid(feature);
    names.push({
      id: feature.properties.id,
      name: feature.properties.name,
      countryId: country.id,
      lat: point.lat,
      lng: point.lng,
    });
  }
  console.log(`${country.id}: ${cleaned.features.length} areas, ${written} bytes (mapshaper ${size})`);
}

const seedPath = join(root, "data/seed.json");
const seed = JSON.parse(readFileSync(seedPath, "utf8"));
for (const country of seed.countries) {
  const collection = collections.get(country.id);
  if (!collection) throw new Error(`No admin-1 file for ${country.id}.`);
  for (const city of country.cities) {
    const hit = collection.features.find((feature) => featureContains(feature, city.lng, city.lat));
    if (hit) {
      city.admin1Id = hit.properties.id;
      continue;
    }
    const near = nearestFeature(collection.features, city.lng, city.lat);
    if (!near) throw new Error(`${city.name} has no nearby area.`);
    city.admin1Id = near.properties.id;
    console.log(`note: ${city.name} in ${country.name} sits outside the simplified shapes, using ${near.properties.name}.`);
  }
}
writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);

names.sort((a, b) => a.countryId.localeCompare(b.countryId) || a.name.localeCompare(b.name));
writeFileSync(join(outDir, "names.json"), `${JSON.stringify(names)}\n`);

const boundsLines = Object.entries(bounds)
  .map(([id, box]) => `  ${JSON.stringify(id)}: { west: ${box.west}, south: ${box.south}, east: ${box.east}, north: ${box.north} },`)
  .join("\n");
writeFileSync(
  join(root, "src/lib/admin1-bounds.ts"),
  `// Generated by scripts/build-admin1.mjs. Do not edit by hand.\nimport type { MapBounds } from "@/lib/map-camera";\n\nexport const ADMIN1_BOUNDS: Record<string, MapBounds> = {\n${boundsLines}\n};\n`,
);

console.log(`Wrote ${wanted.length} country files.`);
