export const FLOW_STEPS = 5;

export const REGIONS = [
  {
    id: "latin-america",
    name: "Latin America",
    open: false,
    left: "4%",
    top: "38%",
    width: "28%",
    height: "52%",
  },
  {
    id: "caribbean",
    name: "Caribbean",
    open: true,
    left: "30%",
    top: "6%",
    width: "36%",
    height: "30%",
  },
  {
    id: "africa",
    name: "Africa",
    open: false,
    left: "34%",
    top: "40%",
    width: "30%",
    height: "50%",
  },
  {
    id: "south-asia",
    name: "South Asia",
    open: false,
    left: "66%",
    top: "16%",
    width: "30%",
    height: "32%",
  },
  {
    id: "southeast-asia",
    name: "Southeast Asia",
    open: false,
    left: "66%",
    top: "54%",
    width: "30%",
    height: "36%",
  },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

export function getRegion(id: string) {
  return REGIONS.find((region) => region.id === id);
}
