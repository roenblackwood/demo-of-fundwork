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
  "Egypt",
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
  caribbean: { center: [-73, 17], zoom: 4, label: [-78, 27] },
  "latin-america": { center: [-82, 4], zoom: 1.35, label: [-78, -8] },
  africa: { center: [16, 2], zoom: 1.7, label: [6, 14] },
  "middle-east": { center: [42, 28], zoom: 3, label: [34, 36] },
  "eastern-europe": { center: [24, 50], zoom: 2.8, label: [14, 56] },
  "south-asia": { center: [80, 22], zoom: 2.6, label: [68, 30] },
  "southeast-asia": { center: [112, 4], zoom: 2.5, label: [104, 12] },
};

export const SHOWCASE = [
  { id: "jamaica", name: "Jamaica", mapName: "Jamaica", regionId: "caribbean", coordinates: [-77.3, 18.15] },
  { id: "barbados", name: "Barbados", mapName: "Barbados", regionId: "caribbean", coordinates: [-59.55, 13.15] },
  { id: "trinidad", name: "Trinidad and Tobago", mapName: "Trinidad and Tobago", regionId: "caribbean", coordinates: [-61.25, 10.45] },
  { id: "colombia", name: "Colombia", mapName: "Colombia", regionId: "latin-america", coordinates: [-74.1, 4.6] },
  { id: "mexico", name: "Mexico", mapName: "Mexico", regionId: "latin-america", coordinates: [-102.5, 23.6] },
  { id: "brazil", name: "Brazil", mapName: "Brazil", regionId: "latin-america", coordinates: [-52, -10] },
  { id: "kenya", name: "Kenya", mapName: "Kenya", regionId: "africa", coordinates: [37.9, 0.2] },
  { id: "ghana", name: "Ghana", mapName: "Ghana", regionId: "africa", coordinates: [-1.2, 7.9] },
  { id: "nigeria", name: "Nigeria", mapName: "Nigeria", regionId: "africa", coordinates: [8.2, 9.6] },
  { id: "jordan", name: "Jordan", mapName: "Jordan", regionId: "middle-east", coordinates: [36.3, 31.2] },
  { id: "lebanon", name: "Lebanon", mapName: "Lebanon", regionId: "middle-east", coordinates: [35.8, 33.9] },
  { id: "uae", name: "United Arab Emirates", mapName: "United Arab Emirates", regionId: "middle-east", coordinates: [54.3, 24.2] },
  { id: "poland", name: "Poland", mapName: "Poland", regionId: "eastern-europe", coordinates: [19.4, 52.1] },
  { id: "romania", name: "Romania", mapName: "Romania", regionId: "eastern-europe", coordinates: [25, 46] },
  { id: "ukraine", name: "Ukraine", mapName: "Ukraine", regionId: "eastern-europe", coordinates: [31.2, 49] },
  { id: "india", name: "India", mapName: "India", regionId: "south-asia", coordinates: [79, 22] },
  { id: "bangladesh", name: "Bangladesh", mapName: "Bangladesh", regionId: "south-asia", coordinates: [90.3, 23.7] },
  { id: "nepal", name: "Nepal", mapName: "Nepal", regionId: "south-asia", coordinates: [84.1, 28.4] },
  { id: "indonesia", name: "Indonesia", mapName: "Indonesia", regionId: "southeast-asia", coordinates: [118, -2] },
  { id: "philippines", name: "Philippines", mapName: "Philippines", regionId: "southeast-asia", coordinates: [122, 12] },
  { id: "vietnam", name: "Vietnam", mapName: "Vietnam", regionId: "southeast-asia", coordinates: [108, 14] },
] as const;

export type ShowcaseCountry = (typeof SHOWCASE)[number];

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
  "eastern-europe": "poland",
  "south-asia": "bangladesh",
  "southeast-asia": "indonesia",
};

export function leadCountry(regionId: RegionId): string {
  return LEADS[regionId];
}
