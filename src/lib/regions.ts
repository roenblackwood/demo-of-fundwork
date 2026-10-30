import { isListableCountry } from "@/lib/country-rules";

/** Jamaica worker path: region, parish, town, skill, photo. */
export const FLOW_STEPS = 5;

export const REGIONS = [
  { id: "caribbean", name: "Caribbean" },
  { id: "latin-america", name: "Latin America" },
  { id: "africa", name: "Africa" },
  { id: "middle-east", name: "Middle East" },
  { id: "eastern-europe", name: "Eastern Europe" },
  { id: "south-asia", name: "South Asia" },
  { id: "southeast-asia", name: "Southeast Asia" },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

export function getRegion(id: string) {
  return REGIONS.find((region) => region.id === id);
}

const LATIN_AMERICA = new Set([
  "Mexico",
  "Guatemala",
  "Belize",
  "Honduras",
  "El Salvador",
  "Nicaragua",
  "Costa Rica",
  "Panama",
  "Argentina",
  "Bolivia",
  "Brazil",
  "Chile",
  "Colombia",
  "Ecuador",
  "Guyana",
  "Paraguay",
  "Peru",
  "Suriname",
  "Uruguay",
  "Venezuela",
  "Falkland Is.",
]);

const CARIBBEAN = new Set([
  "Anguilla",
  "Antigua and Barb.",
  "Aruba",
  "Bahamas",
  "Barbados",
  "British Virgin Is.",
  "Cayman Is.",
  "Cuba",
  "Curaçao",
  "Dominica",
  "Dominican Rep.",
  "Grenada",
  "Haiti",
  "Jamaica",
  "Montserrat",
  "Puerto Rico",
  "Saint Lucia",
  "Sint Maarten",
  "St-Barthélemy",
  "St-Martin",
  "St. Kitts and Nevis",
  "St. Vin. and Gren.",
  "Trinidad and Tobago",
  "Turks and Caicos Is.",
  "U.S. Virgin Is.",
]);

const AFRICA = new Set([
  "Algeria",
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cameroon",
  "Central African Rep.",
  "Chad",
  "Comoros",
  "Congo",
  "Côte d'Ivoire",
  "Dem. Rep. Congo",
  "Djibouti",
  "Eq. Guinea",
  "Eritrea",
  "eSwatini",
  "Ethiopia",
  "Gabon",
  "Gambia",
  "Ghana",
  "Guinea",
  "Guinea-Bissau",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Libya",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Niger",
  "Nigeria",
  "Rwanda",
  "Saint Helena",
  "São Tomé and Principe",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Somalia",
  "Somaliland",
  "South Africa",
  "S. Sudan",
  "Sudan",
  "Tanzania",
  "Togo",
  "Tunisia",
  "Uganda",
  "W. Sahara",
  "Zambia",
  "Zimbabwe",
]);

const SOUTH_ASIA = new Set([
  "Afghanistan",
  "Bangladesh",
  "Bhutan",
  "India",
  "Maldives",
  "Nepal",
  "Pakistan",
  "Sri Lanka",
]);

const MIDDLE_EAST = new Set([
  "Egypt",
  "Jordan",
  "Lebanon",
  "Syria",
  "Iraq",
  "Saudi Arabia",
  "United Arab Emirates",
  "Oman",
  "Yemen",
  "Kuwait",
  "Qatar",
  "Bahrain",
  "Palestine",
]);

const EASTERN_EUROPE = new Set([
  "Poland",
  "Romania",
  "Ukraine",
  "Czechia",
  "Slovakia",
  "Hungary",
  "Bulgaria",
  "Moldova",
  "Belarus",
]);

const SOUTHEAST_ASIA = new Set([
  "Brunei",
  "Cambodia",
  "Indonesia",
  "Laos",
  "Malaysia",
  "Myanmar",
  "Philippines",
  "Singapore",
  "Thailand",
  "Timor-Leste",
  "Vietnam",
]);

const BY_NAME: Record<string, RegionId> = {};
for (const name of LATIN_AMERICA) BY_NAME[name] = "latin-america";
for (const name of CARIBBEAN) BY_NAME[name] = "caribbean";
for (const name of AFRICA) BY_NAME[name] = "africa";
for (const name of SOUTH_ASIA) BY_NAME[name] = "south-asia";
for (const name of SOUTHEAST_ASIA) BY_NAME[name] = "southeast-asia";
for (const name of MIDDLE_EAST) BY_NAME[name] = "middle-east";
for (const name of EASTERN_EUROPE) BY_NAME[name] = "eastern-europe";

export function regionForCountry(name: string): RegionId | null {
  return BY_NAME[name] ?? null;
}

export const REGION_VIEWS: Record<
  RegionId,
  { center: [number, number]; zoom: number; label: [number, number] }
> = {
  caribbean: { center: [-70, 17.5], zoom: 4, label: [-88, 32] },
  "latin-america": { center: [-80, 6], zoom: 1.35, label: [-64, -18] },
  africa: { center: [20, 1], zoom: 1.6, label: [8, 2] },
  "middle-east": { center: [36.3, 31.2], zoom: 3.2, label: [42, 34] },
  "eastern-europe": { center: [28, 49], zoom: 2.8, label: [25, 53] },
  "south-asia": { center: [74, 26], zoom: 2.4, label: [78, 14] },
  "southeast-asia": { center: [112, 4], zoom: 2.5, label: [85, -12] },
};

const PLACES = [
  { id: "jamaica", name: "Jamaica", mapName: "Jamaica", regionId: "caribbean", coordinates: [-77.3, 18.15] },
  { id: "dominican-republic", name: "Dominican Republic", mapName: "Dominican Rep.", regionId: "caribbean", coordinates: [-70.4, 18.7] },
  { id: "barbados", name: "Barbados", mapName: "Barbados", regionId: "caribbean", coordinates: [-59.55, 13.15] },
  { id: "colombia", name: "Colombia", mapName: "Colombia", regionId: "latin-america", coordinates: [-74.1, 4.6] },
  { id: "mexico", name: "Mexico", mapName: "Mexico", regionId: "latin-america", coordinates: [-102.5, 23.6] },
  { id: "el-salvador", name: "El Salvador", mapName: "El Salvador", regionId: "latin-america", coordinates: [-88.9, 13.8] },
  { id: "brazil", name: "Brazil", mapName: "Brazil", regionId: "latin-america", coordinates: [-52, -10] },
  { id: "kenya", name: "Kenya", mapName: "Kenya", regionId: "africa", coordinates: [37.9, 0.2] },
  { id: "ghana", name: "Ghana", mapName: "Ghana", regionId: "africa", coordinates: [-1.2, 7.9] },
  { id: "rwanda", name: "Rwanda", mapName: "Rwanda", regionId: "africa", coordinates: [29.9, -2] },
  { id: "nigeria", name: "Nigeria", mapName: "Nigeria", regionId: "africa", coordinates: [8.2, 9.6] },
  { id: "jordan", name: "Jordan", mapName: "Jordan", regionId: "middle-east", coordinates: [36.3, 31.2] },
  { id: "moldova", name: "Moldova", mapName: "Moldova", regionId: "eastern-europe", coordinates: [28.6, 47] },
  { id: "romania", name: "Romania", mapName: "Romania", regionId: "eastern-europe", coordinates: [25, 46] },
  { id: "ukraine", name: "Ukraine", mapName: "Ukraine", regionId: "eastern-europe", coordinates: [31.2, 49] },
  { id: "india", name: "India", mapName: "India", regionId: "south-asia", coordinates: [79, 22] },
  { id: "pakistan", name: "Pakistan", mapName: "Pakistan", regionId: "south-asia", coordinates: [69.3, 30.4] },
  { id: "indonesia", name: "Indonesia", mapName: "Indonesia", regionId: "southeast-asia", coordinates: [118, -2] },
  { id: "philippines", name: "Philippines", mapName: "Philippines", regionId: "southeast-asia", coordinates: [122, 12] },
  { id: "vietnam", name: "Vietnam", mapName: "Vietnam", regionId: "southeast-asia", coordinates: [108, 14] },
] as const;

export type ShowcaseCountry = (typeof PLACES)[number];

export const SHOWCASE = PLACES.filter((country) => isListableCountry(country.id));

export function showcaseByMapName(name: string) {
  return SHOWCASE.find((country) => country.mapName === name);
}

export function showcaseById(id: string) {
  return SHOWCASE.find((country) => country.id === id);
}

export function countriesIn(regionId: RegionId) {
  return SHOWCASE.filter((country) => country.regionId === regionId);
}

const LEADS: Record<RegionId, string> = {
  caribbean: "jamaica",
  "latin-america": "colombia",
  africa: "kenya",
  "middle-east": "jordan",
  "eastern-europe": "moldova",
  "south-asia": "india",
  "southeast-asia": "indonesia",
};

export function leadCountry(regionId: RegionId): string {
  return LEADS[regionId];
}
