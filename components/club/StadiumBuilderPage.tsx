"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Hammer, Layers3, Save, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { edenExistingBoxes } from './stadiumVisualDesigns';

const EdenGardensViewer3D = dynamic(() => import("./EdenGardensViewer3D"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-[#17241c] font-space-mono text-[8px] font-bold uppercase tracking-widest text-white/70">Loading stadium viewer…</div>,
});

type Quality = "Basic" | "Standard" | "Modern" | "Premium" | "Elite";
type Roof = "None" | "Partial canopy" | "Full roof" | "Cantilever" | "Landmark roof";
type Action = "replace" | "add-tier" | "refurbish" | "demolish";
type ProjectPhase = "demolition" | "cleared" | "construction" | "completed" | "cancelled";

interface StandTemplate {
  id: string;
  name: string;
  tiers: number;
  capacityMultiplier: number;
  priceCrorePerModule: number;
  constructionDays: number;
  hospitality: boolean;
  supportsTierExpansion: boolean;
  color: string;
}

interface StadiumModule {
  hospitalityBoxes?: number;
  id: number;
  standName: string;
  templateId: string;
  quality: Quality;
  roof: Roof;
  capacity: number;
  baseCapacity: number;
  constructionYear: number;
  lastRefurbishedYear: number;
  condition: number;
  fanOpinion: number;
  maxTiers: number;
  empty?: boolean;
}

interface StadiumPlan {
  id: string;
  name: string;
  moduleIds: number[];
  action: Action;
  templateId: string;
  quality: Quality;
  roof: Roof;
  priceCrore: number;
  capacityDelta: number;
  demolitionDays: number;
  constructionDays: number;
  fanReaction: number;
  createdOn: string;
}

interface StadiumProject extends StadiumPlan {
  startedOn: string;
  demolitionCompletesOn?: string;
  constructionStartsOn?: string;
  constructionCompletesOn: string;
  phase: ProjectPhase;
}

interface StoredBuilderState {
  modules: StadiumModule[];
  plans: StadiumPlan[];
  activeProject: StadiumProject | null;
  projectHistory: StadiumProject[];
}

interface StadiumBuilderPageProps {
  teamId: string;
  currentDate: string;
  saveId: string;
  pitchCount: number;
}

const TEMPLATES: StandTemplate[] = [
  { id: "open-tier", name: "Open single tier", tiers: 1, capacityMultiplier: .72, priceCrorePerModule: 42, constructionDays: 150, hospitality: false, supportsTierExpansion: true, color: "#6f4b8b" },
  { id: "covered-tier", name: "Covered single tier", tiers: 1, capacityMultiplier: .65, priceCrorePerModule: 56, constructionDays: 180, hospitality: false, supportsTierExpansion: true, color: "#8256a0" },
  { id: "compact-two", name: "Compact two tier", tiers: 2, capacityMultiplier: .88, priceCrorePerModule: 78, constructionDays: 240, hospitality: false, supportsTierExpansion: true, color: "#5e347c" },
  { id: "standard-two", name: "Standard two tier", tiers: 2, capacityMultiplier: 1, priceCrorePerModule: 92, constructionDays: 285, hospitality: false, supportsTierExpansion: true, color: "#4a225f" },
  { id: "large-three", name: "Large three tier", tiers: 3, capacityMultiplier: 1.18, priceCrorePerModule: 132, constructionDays: 390, hospitality: false, supportsTierExpansion: true, color: "#351646" },
  { id: "four-grandstand", name: "Four-tier grandstand", tiers: 4, capacityMultiplier: 1.28, priceCrorePerModule: 188, constructionDays: 540, hospitality: false, supportsTierExpansion: false, color: "#25102f" },
  { id: "pavilion", name: "Pavilion stand", tiers: 2, capacityMultiplier: .78, priceCrorePerModule: 118, constructionDays: 330, hospitality: true, supportsTierExpansion: true, color: "#7a5b35" },
  { id: "heritage", name: "Heritage members' stand", tiers: 2, capacityMultiplier: .62, priceCrorePerModule: 136, constructionDays: 360, hospitality: true, supportsTierExpansion: false, color: "#8a6b3f" },
  { id: "hospitality-two", name: "Two-tier hospitality", tiers: 2, capacityMultiplier: .58, priceCrorePerModule: 154, constructionDays: 375, hospitality: true, supportsTierExpansion: true, color: "#8d2455" },
  { id: "hospitality-three", name: "Three-tier hospitality", tiers: 3, capacityMultiplier: .82, priceCrorePerModule: 205, constructionDays: 480, hospitality: true, supportsTierExpansion: false, color: "#68193d" },
  { id: "corporate", name: "Corporate-box stand", tiers: 2, capacityMultiplier: .48, priceCrorePerModule: 176, constructionDays: 420, hospitality: true, supportsTierExpansion: false, color: "#244b70" },
  { id: "media", name: "Media pavilion", tiers: 2, capacityMultiplier: .44, priceCrorePerModule: 164, constructionDays: 390, hospitality: true, supportsTierExpansion: false, color: "#3d5368" },
  { id: "premium", name: "Premium grandstand", tiers: 3, capacityMultiplier: .98, priceCrorePerModule: 218, constructionDays: 510, hospitality: true, supportsTierExpansion: false, color: "#573a13" },
  { id: "landmark", name: "Landmark grandstand", tiers: 4, capacityMultiplier: 1.16, priceCrorePerModule: 285, constructionDays: 720, hospitality: true, supportsTierExpansion: false, color: "#151a32" },
];

const QUALITY_MULTIPLIER: Record<Quality, number> = { Basic: 0.82, Standard: 1, Modern: 1.18, Premium: 1.43, Elite: 1.72 };
const ROOF_PRICE: Record<Roof, number> = { None: 0, "Partial canopy": 8, "Full roof": 17, Cantilever: 28, "Landmark roof": 48 };
const QUALITY_CAPACITY: Record<Quality, number> = { Basic: 0.96, Standard: 1, Modern: 1, Premium: 1.02, Elite: 1.04 };

const template = (id: string) => TEMPLATES.find((entry) => entry.id === id) ?? TEMPLATES[3];
const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const money = (value: number) => `₹${value.toFixed(1)} Cr`;
const integer = (value: number) => new Intl.NumberFormat("en-GB").format(Math.round(value));

const EDEN_GROUPS: Array<{ name: string; count: number; templateId: string; year: number; refurbished: number; condition: number; fan: number; maxTiers: number; capacity: number; roof: Roof }> = [
  { name: "B.C. Roy Club House", count: 2, templateId: "pavilion", year: 1970, refurbished: 2011, condition: 74, fan: 94, maxTiers: 3, capacity: 2500, roof: "Full roof" },
  { name: "B Stand", count: 2, templateId: "compact-two", year: 1987, refurbished: 2011, condition: 72, fan: 78, maxTiers: 3, capacity: 2700, roof: "Partial canopy" },
  { name: "C Stand", count: 2, templateId: "standard-two", year: 1987, refurbished: 2011, condition: 75, fan: 72, maxTiers: 3, capacity: 2950, roof: "Partial canopy" },
  { name: "D Stand", count: 3, templateId: "large-three", year: 1993, refurbished: 2011, condition: 78, fan: 81, maxTiers: 4, capacity: 3300, roof: "Full roof" },
  { name: "E Stand", count: 3, templateId: "large-three", year: 1993, refurbished: 2011, condition: 77, fan: 76, maxTiers: 4, capacity: 3300, roof: "Full roof" },
  { name: "F Stand", count: 3, templateId: "standard-two", year: 1987, refurbished: 2011, condition: 71, fan: 68, maxTiers: 3, capacity: 3000, roof: "Partial canopy" },
  { name: "G Stand", count: 2, templateId: "standard-two", year: 1987, refurbished: 2011, condition: 70, fan: 67, maxTiers: 3, capacity: 3000, roof: "Partial canopy" },
  { name: "H Stand", count: 2, templateId: "compact-two", year: 1987, refurbished: 2011, condition: 69, fan: 65, maxTiers: 3, capacity: 2700, roof: "Partial canopy" },
  { name: "J Stand", count: 1, templateId: "covered-tier", year: 1987, refurbished: 2011, condition: 68, fan: 62, maxTiers: 2, capacity: 2300, roof: "Partial canopy" },
  { name: "K Stand", count: 1, templateId: "covered-tier", year: 1987, refurbished: 2011, condition: 68, fan: 64, maxTiers: 2, capacity: 2300, roof: "Partial canopy" },
  { name: "L Stand", count: 1, templateId: "heritage", year: 1967, refurbished: 2011, condition: 73, fan: 88, maxTiers: 2, capacity: 2050, roof: "Full roof" },
  { name: "High Court Pavilion", count: 2, templateId: "pavilion", year: 1970, refurbished: 2011, condition: 76, fan: 90, maxTiers: 3, capacity: 2500, roof: "Full roof" },
];

function createEdenModules(): StadiumModule[] {
  let id = 0;
  return EDEN_GROUPS.flatMap((group) => Array.from({ length: group.count }, () => ({
    id: id++, standName: group.name, templateId: group.templateId, quality: "Modern" as Quality,
    roof: group.roof, capacity: group.capacity, baseCapacity: Math.round(group.capacity / template(group.templateId).capacityMultiplier), constructionYear: group.year,
    lastRefurbishedYear: group.refurbished, condition: group.condition,
    fanOpinion: group.fan, maxTiers: group.maxTiers,
    hospitalityBoxes: group.name === 'B Stand' ? 4 : group.name === 'L Stand' ? 7 : undefined,
  })));
}

type VenueStand = { name: string; modules: number; templateId: string; roof: Roof; maxTiers: number; weight: number };
type TeamStadium = { name: string; ends: [string, string]; capacity: number; association: string; opened: number; stands: VenueStand[] };

/**
 * Baseline venue facts are intentionally separate from upgrade templates. Capacities and
 * end names below are published venue facts; individual module capacities are a proportional
 * representation for the builder and always total exactly to the published venue capacity.
 */
const TEAM_STADIUMS: Record<string, TeamStadium> = {
  CSK: { name: "M.A. Chidambaram Stadium", ends: ["Anna Pavilion End", "V. Pattabhiraman Gate End"], capacity: 38_200, association: "Tamil Nadu Cricket Association", opened: 1916, stands: [
    { name: "Anna Pavilion", modules: 2, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1.1 }, { name: "I Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "J Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "K Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "C-D-E Lower Tier", modules: 5, templateId: "covered-tier", roof: "Full roof", maxTiers: 2, weight: .9 }, { name: "C-D-E Upper Tier", modules: 5, templateId: "standard-two", roof: "Full roof", maxTiers: 3, weight: 1.05 }, { name: "M.K.M. Terrace", modules: 3, templateId: "covered-tier", roof: "Partial canopy", maxTiers: 2, weight: .8 },
  ] },
  DC: { name: "Arun Jaitley Stadium", ends: ["Stadium End", "Pavilion End"], capacity: 35_200, association: "Delhi & District Cricket Association", opened: 1883, stands: [
    { name: "Willingdon Pavilion", modules: 3, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1.05 }, { name: "North-East Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "East Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "South-East Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "South-West Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "West Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "North-West Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "Club House", modules: 3, templateId: "heritage", roof: "Full roof", maxTiers: 2, weight: .8 },
  ] },
  GT: { name: "Narendra Modi Stadium", ends: ["Adani Pavilion End", "Jio End"], capacity: 132_000, association: "Gujarat Cricket Association", opened: 2020, stands: [
    { name: "Adani Pavilion", modules: 3, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "East Bowl", modules: 6, templateId: "four-grandstand", roof: "Full roof", maxTiers: 4, weight: 1.25 }, { name: "North Bowl", modules: 3, templateId: "four-grandstand", roof: "Full roof", maxTiers: 4, weight: 1.2 }, { name: "West Bowl", modules: 6, templateId: "four-grandstand", roof: "Full roof", maxTiers: 4, weight: 1.25 }, { name: "South Bowl", modules: 3, templateId: "four-grandstand", roof: "Full roof", maxTiers: 4, weight: 1.2 }, { name: "Jio End Pavilion", modules: 3, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1 },
  ] },
  MI: { name: "Wankhede Stadium", ends: ["Garware Pavilion End", "Tata End"], capacity: 33_100, association: "Mumbai Cricket Association", opened: 1974, stands: [
    { name: "Garware Pavilion", modules: 3, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "Sunil Gavaskar Stand", modules: 3, templateId: "standard-two", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "Vijay Merchant Stand", modules: 3, templateId: "standard-two", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "Sachin Tendulkar Stand", modules: 3, templateId: "standard-two", roof: "Full roof", maxTiers: 3, weight: 1.05 }, { name: "Dilip Vengsarkar Stand", modules: 3, templateId: "standard-two", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "MCA Pavilion", modules: 3, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "North Stand", modules: 3, templateId: "covered-tier", roof: "Partial canopy", maxTiers: 2, weight: .9 }, { name: "East Stand", modules: 3, templateId: "covered-tier", roof: "Partial canopy", maxTiers: 2, weight: .9 },
  ] },
  PBKS: { name: "Maharaja Yadavindra Singh International Cricket Stadium", ends: ["North End", "South End"], capacity: 38_000, association: "Punjab Cricket Association", opened: 2021, stands: [
    { name: "South Pavilion", modules: 3, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "East Terrace A", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "East Terrace B", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "North Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "West Terrace A", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "West Terrace B", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "South-West Stand", modules: 3, templateId: "covered-tier", roof: "Full roof", maxTiers: 2, weight: .9 }, { name: "South-East Stand", modules: 3, templateId: "covered-tier", roof: "Full roof", maxTiers: 2, weight: .9 },
  ] },
  RR: { name: "Sawai Mansingh Stadium", ends: ["Van Vihar Colony End", "Garh Ganesh Temple End"], capacity: 30_000, association: "Rajasthan Cricket Association", opened: 1969, stands: [
    { name: "Madhavrao Scindia Pavilion", modules: 3, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "North Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "East Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "South Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "West Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "North-East Stand", modules: 3, templateId: "covered-tier", roof: "Partial canopy", maxTiers: 2, weight: .9 }, { name: "South-West Stand", modules: 3, templateId: "covered-tier", roof: "Partial canopy", maxTiers: 2, weight: .9 }, { name: "Members' Pavilion", modules: 3, templateId: "heritage", roof: "Full roof", maxTiers: 2, weight: .8 },
  ] },
  RCB: { name: "M. Chinnaswamy Stadium", ends: ["Pavilion End", "BEML End"], capacity: 33_800, association: "Karnataka State Cricket Association", opened: 1969, stands: [
    { name: "Pavilion", modules: 3, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "P Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "B Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "C Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "D Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "E Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "F Stand", modules: 3, templateId: "covered-tier", roof: "Partial canopy", maxTiers: 2, weight: .9 }, { name: "G-H Stand", modules: 3, templateId: "covered-tier", roof: "Partial canopy", maxTiers: 2, weight: .9 },
  ] },
  SRH: { name: "Rajiv Gandhi International Stadium", ends: ["Pavilion End", "North End"], capacity: 39_200, association: "Hyderabad Cricket Association", opened: 2003, stands: [
    { name: "Pavilion", modules: 3, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "North Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "North-East Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "East Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "South-East Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "South Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "West Stand", modules: 3, templateId: "standard-two", roof: "Partial canopy", maxTiers: 3, weight: 1 }, { name: "Members' Pavilion", modules: 3, templateId: "heritage", roof: "Full roof", maxTiers: 2, weight: .85 },
  ] },
  LSG: { name: "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium", ends: ["North End", "South End"], capacity: 50_100, association: "Uttar Pradesh Cricket Association", opened: 2017, stands: [
    { name: "South Pavilion", modules: 3, templateId: "pavilion", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "East Lower Tier", modules: 3, templateId: "standard-two", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "East Upper Tier", modules: 3, templateId: "large-three", roof: "Full roof", maxTiers: 4, weight: 1.15 }, { name: "North Stand", modules: 3, templateId: "large-three", roof: "Full roof", maxTiers: 4, weight: 1.15 }, { name: "West Upper Tier", modules: 3, templateId: "large-three", roof: "Full roof", maxTiers: 4, weight: 1.15 }, { name: "West Lower Tier", modules: 3, templateId: "standard-two", roof: "Full roof", maxTiers: 3, weight: 1 }, { name: "South-West Stand", modules: 3, templateId: "covered-tier", roof: "Full roof", maxTiers: 2, weight: .9 }, { name: "South-East Stand", modules: 3, templateId: "covered-tier", roof: "Full roof", maxTiers: 2, weight: .9 },
  ] },
};

function createTeamModules(teamId: string): StadiumModule[] {
  if (teamId.toUpperCase() === "KKR") return createEdenModules();
  const stadium = TEAM_STADIUMS[teamId.toUpperCase()] ?? TEAM_STADIUMS.CSK;
  const unitWeight = stadium.stands.reduce((sum, stand) => sum + stand.modules * stand.weight, 0);
  let allocated = 0;
  let id = 0;
  const modules = stadium.stands.flatMap((stand, groupIndex) => Array.from({ length: stand.modules }, (_, moduleIndex) => {
    const isLast = groupIndex === stadium.stands.length - 1 && moduleIndex === stand.modules - 1;
    const capacity = isLast ? stadium.capacity - allocated : Math.round(stadium.capacity * stand.weight / unitWeight);
    allocated += capacity;
    return {
      id: id++, standName: stand.name, templateId: stand.templateId, quality: "Modern" as Quality, roof: stand.roof,
      capacity, baseCapacity: Math.round(capacity / template(stand.templateId).capacityMultiplier), constructionYear: stadium.opened,
      lastRefurbishedYear: stadium.opened < 2000 ? 2011 : stadium.opened, condition: stadium.opened < 2000 ? 74 : 88,
      fanOpinion: 70 + Math.min(18, Math.round(stand.weight * 8)), maxTiers: stand.maxTiers, empty: false,
    };
  }));
  return modules;
}

function annularSegment(index: number, count: number, inner = 116, outer = 172) {
  const gap = 1.4;
  const start = index / count * 360 - 90 + gap;
  const end = (index + 1) / count * 360 - 90 - gap;
  const point = (radius: number, degrees: number) => {
    const radians = degrees * Math.PI / 180;
    return [200 + Math.cos(radians) * radius, 200 + Math.sin(radians) * radius];
  };
  const [a, b, c, d] = [point(outer, start), point(outer, end), point(inner, end), point(inner, start)];
  return `M ${a[0]} ${a[1]} A ${outer} ${outer} 0 0 1 ${b[0]} ${b[1]} L ${c[0]} ${c[1]} A ${inner} ${inner} 0 0 0 ${d[0]} ${d[1]} Z`;
}

function standArc(index: number, count: number, radius: number) {
  const gap = 1.8;
  const start = index / count * 360 - 90 + gap;
  const end = (index + 1) / count * 360 - 90 - gap;
  const point = (degrees: number) => {
    const radians = degrees * Math.PI / 180;
    return [200 + Math.cos(radians) * radius, 200 + Math.sin(radians) * radius];
  };
  const [a, b] = [point(start), point(end)];
  return `M ${a[0]} ${a[1]} A ${radius} ${radius} 0 0 1 ${b[0]} ${b[1]}`;
}

function standConnector(index: number, count: number, inner = 116, outer = 172) {
  const boundary = (index + 1) / count * 360 - 90;
  const start = boundary - 2.8;
  const end = boundary + 2.8;
  const point = (radius: number, degrees: number) => {
    const radians = degrees * Math.PI / 180;
    return [200 + Math.cos(radians) * radius, 200 + Math.sin(radians) * radius];
  };
  const [a, b, c, d] = [point(outer, start), point(outer, end), point(inner, end), point(inner, start)];
  return `M ${a[0]} ${a[1]} A ${outer} ${outer} 0 0 1 ${b[0]} ${b[1]} L ${c[0]} ${c[1]} A ${inner} ${inner} 0 0 0 ${d[0]} ${d[1]} Z`;
}

const shortStandName = (name: string) => name
  .replace("B.C. Roy Club House", "B.C. ROY")
  .replace("High Court Pavilion", "HIGH COURT")
  .replace(" Stand", "")
  .toUpperCase();

function isContiguous(ids: number[], count: number) {
  if (ids.length <= 1) return true;
  const sorted = [...ids].sort((a, b) => a - b);
  const direct = sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);
  const wrapped = sorted.includes(0) && sorted.includes(count - 1)
    && [...sorted.map((value) => value < count / 2 ? value + count : value)].sort((a, b) => a - b)
      .every((value, index, values) => index === 0 || value === values[index - 1] + 1);
  return direct || wrapped;
}

export default function StadiumBuilderPage({ teamId, currentDate, saveId, pitchCount }: StadiumBuilderPageProps) {
  const stadiumProfile = teamId.toUpperCase() === "KKR" ? { name: "Eden Gardens", ends: ["High Court End", "Pavilion End"] as [string, string], capacity: 67_551, association: "Cricket Association of Bengal", opened: 1864 } : (TEAM_STADIUMS[teamId.toUpperCase()] ?? TEAM_STADIUMS.CSK);
  // v2 deliberately replaces the original generic non-KKR placeholder plans.
  const storageKey = `ipl-stadium-builder:${saveId || "career"}:${teamId}:v2`;
  const [modules, setModules] = useState<StadiumModule[]>(() => createTeamModules(teamId));
  const [plans, setPlans] = useState<StadiumPlan[]>([]);
  const [activeProject, setActiveProject] = useState<StadiumProject | null>(null);
  const [projectHistory, setProjectHistory] = useState<StadiumProject[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [action, setAction] = useState<Action>("replace");
  const [templateId, setTemplateId] = useState("standard-two");
  const [quality, setQuality] = useState<Quality>("Modern");
  const [roof, setRoof] = useState<Roof>("Full roof");
  const [planName, setPlanName] = useState("");
  const [message, setMessage] = useState("");
  const [showPlans, setShowPlans] = useState(false);
  const [viewMode, setViewMode] = useState<"plan" | "viewer">("plan");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "null") as StoredBuilderState | null;
      if (parsed?.modules?.length === createTeamModules(teamId).length) setModules(parsed.modules.map((entry) => ({ ...entry, hospitalityBoxes: teamId.toUpperCase() === 'KKR' ? edenExistingBoxes(entry) : entry.hospitalityBoxes, baseCapacity: entry.baseCapacity ?? Math.round(entry.capacity / template(entry.templateId).capacityMultiplier) })));
      if (Array.isArray(parsed?.plans)) setPlans(parsed!.plans);
      if (parsed?.activeProject) setActiveProject(parsed.activeProject);
      if (Array.isArray(parsed?.projectHistory)) setProjectHistory(parsed!.projectHistory);
    } catch { /* A malformed prototype save falls back to Eden defaults. */ }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(storageKey, JSON.stringify({ modules, plans, activeProject, projectHistory } satisfies StoredBuilderState));
  }, [activeProject, loaded, modules, plans, projectHistory, storageKey]);

  useEffect(() => {
    if (!activeProject || activeProject.phase === "completed" || activeProject.phase === "cancelled") return;
    let phase: ProjectPhase = activeProject.phase;
    if (activeProject.demolitionCompletesOn && currentDate >= activeProject.demolitionCompletesOn && currentDate < activeProject.constructionStartsOn!) phase = "cleared";
    if (activeProject.constructionStartsOn && currentDate >= activeProject.constructionStartsOn && currentDate < activeProject.constructionCompletesOn) phase = "construction";
    if (currentDate >= activeProject.constructionCompletesOn) phase = "completed";
    if (phase === activeProject.phase) return;
    if (phase === "cleared") setModules((current) => current.map((entry) => activeProject.moduleIds.includes(entry.id) ? { ...entry, empty: true, capacity: 0 } : entry));
    if (phase === "completed") {
      setModules((current) => current.map((entry) => {
        if (!activeProject.moduleIds.includes(entry.id)) return entry;
        if (activeProject.action === "demolish") return { ...entry, empty: true, capacity: 0 };
        const chosen = template(activeProject.templateId);
        if (activeProject.action === "refurbish") return { ...entry, quality: activeProject.quality, roof: activeProject.roof, condition: 100, lastRefurbishedYear: Number(currentDate.slice(0, 4)) };
        if (activeProject.action === "add-tier") return { ...entry, templateId: activeProject.templateId, quality: activeProject.quality, roof: activeProject.roof, capacity: Math.round(entry.baseCapacity * chosen.capacityMultiplier * QUALITY_CAPACITY[activeProject.quality]), condition: 100, lastRefurbishedYear: Number(currentDate.slice(0, 4)) };
        return { ...entry, standName: activeProject.name, templateId: chosen.id, quality: activeProject.quality, roof: activeProject.roof, capacity: Math.round(entry.baseCapacity * chosen.capacityMultiplier * QUALITY_CAPACITY[activeProject.quality]), constructionYear: Number(currentDate.slice(0, 4)), lastRefurbishedYear: Number(currentDate.slice(0, 4)), condition: 100, maxTiers: Math.max(chosen.tiers, chosen.tiers + Number(chosen.supportsTierExpansion)), empty: false };
      }));
      setProjectHistory((current) => current.some((entry) => entry.id === activeProject.id) ? current : [{ ...activeProject, phase: "completed" }, ...current]);
    }
    setActiveProject((current) => current ? { ...current, phase } : current);
  }, [activeProject, currentDate]);

  const selectedModules = selected.map((id) => modules[id]).filter(Boolean);
  const chosenTemplate = template(templateId);
  const oldCapacity = selectedModules.reduce((sum, entry) => sum + entry.capacity, 0);
  const newCapacity = action === "demolish" ? 0 : action === "refurbish" ? oldCapacity : action === "add-tier"
    ? selectedModules.reduce((sum, entry) => sum + Math.round(entry.baseCapacity * chosenTemplate.capacityMultiplier * QUALITY_CAPACITY[quality]), 0)
    : selectedModules.reduce((sum, entry) => sum + Math.round(entry.baseCapacity * chosenTemplate.capacityMultiplier * QUALITY_CAPACITY[quality]), 0);
  const priceCrore = selected.length * (action === "demolish" ? 16 : action === "refurbish" ? 24 * QUALITY_MULTIPLIER[quality] : chosenTemplate.priceCrorePerModule * QUALITY_MULTIPLIER[quality] + ROOF_PRICE[roof]);
  const constructionDays = action === "demolish" ? 0 : action === "refurbish" ? 120 : action === "add-tier" ? 300 : chosenTemplate.constructionDays;
  const demolitionDays = action === "replace" || action === "demolish" ? 60 + selected.length * 15 : 0;
  const fanReaction = selected.length ? Math.round(selectedModules.reduce((sum, entry) => sum + (action === "refurbish" ? entry.fanOpinion * 0.08 : action === "demolish" ? -entry.fanOpinion * 0.13 : -entry.fanOpinion * 0.05), 0)) : 0;
  const totalCapacity = modules.reduce((sum, entry) => sum + entry.capacity, 0);
  const selectedCapacity = selectedModules.reduce((sum, entry) => sum + entry.capacity, 0);
  const projectedCapacity = totalCapacity - selectedCapacity + newCapacity;
  const changeReason = action === "replace" ? `Replacement with ${chosenTemplate.name} at ${quality} quality${roof === "None" ? "" : ` and ${roof.toLowerCase()}`}.` : action === "add-tier" ? `Adds one tier to each eligible selected section.` : action === "refurbish" ? `Capacity is unchanged; ${quality} refurbishment improves the existing stand.` : "Selected sections are demolished and become unavailable.";
  const standLabels = useMemo(() => Array.from(new Set(modules.map((entry) => entry.standName))).map((name) => {
    const ids = modules.filter((entry) => entry.standName === name).map((entry) => entry.id);
    const midpoint = (ids[0] + ids[ids.length - 1] + 1) / 2;
    const angle = midpoint / modules.length * 360 - 90;
    const radians = angle * Math.PI / 180;
    return { name, x: 200 + Math.cos(radians) * 145, y: 200 + Math.sin(radians) * 145 };
  }), [modules]);

  const toggleModule = (id: number) => {
    const next = selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id];
    if (next.length > 4) return setMessage("A project can cover no more than four modules.");
    if (!isContiguous(next, modules.length)) return setMessage("Select adjacent modules to create one continuous project.");
    setMessage("");
    setSelected(next);
  };

  const createPlan = (): StadiumPlan | null => {
    if (selected.length === 0) { setMessage("Select at least one stadium module."); return null; }
    if (action === "add-tier" && selectedModules.some((entry) => template(entry.templateId).tiers >= entry.maxTiers || entry.empty)) { setMessage("One or more selected sections cannot support another tier."); return null; }
    if (action === "add-tier" && selectedModules.some((entry) => chosenTemplate.tiers !== template(entry.templateId).tiers + 1 || chosenTemplate.tiers > entry.maxTiers)) { setMessage("Choose a template exactly one tier above every selected section."); return null; }
    const plan: StadiumPlan = {
      id: `eden-plan-${Date.now()}`, name: planName.trim() || `${chosenTemplate.name} concept`, moduleIds: [...selected].sort((a, b) => a - b),
      action, templateId, quality, roof, priceCrore: Math.round(priceCrore * 10) / 10, capacityDelta: newCapacity - oldCapacity,
      demolitionDays, constructionDays, fanReaction, createdOn: currentDate,
    };
    setPlans((current) => [plan, ...current]);
    setPlanName("");
    setMessage("Plan saved to the concept library.");
    return plan;
  };

  const putIntoConstruction = () => {
    if (activeProject && !["completed", "cancelled"].includes(activeProject.phase)) { setMessage("Only one stadium project can run at a time."); return; }
    const plan = createPlan();
    if (plan) startProject(plan);
  };

  const startProject = (plan: StadiumPlan) => {
    if (activeProject && activeProject.phase !== "completed" && activeProject.phase !== "cancelled") return setMessage("Only one stadium project can run at a time.");
    const demolitionCompletesOn = plan.demolitionDays ? addDays(currentDate, plan.demolitionDays) : undefined;
    const constructionStartsOn = plan.action === "demolish" ? undefined : addDays(demolitionCompletesOn ?? currentDate, plan.demolitionDays ? 7 : 0);
    const constructionCompletesOn = plan.action === "demolish" ? demolitionCompletesOn! : addDays(constructionStartsOn!, plan.constructionDays);
    setActiveProject({ ...plan, startedOn: currentDate, demolitionCompletesOn, constructionStartsOn, constructionCompletesOn, phase: plan.demolitionDays ? "demolition" : "construction" });
    setMessage("Project started. Its nominal cost is recorded but has not been charged.");
  };

  const cancelProject = () => {
    if (!activeProject) return;
    if (["cleared", "construction"].includes(activeProject.phase)) setModules((current) => current.map((entry) => activeProject.moduleIds.includes(entry.id) ? { ...entry, empty: true, capacity: 0 } : entry));
    setProjectHistory((current) => current.some((entry) => entry.id === activeProject.id) ? current : [{ ...activeProject, phase: "cancelled" }, ...current]);
    setActiveProject({ ...activeProject, phase: "cancelled" });
    setMessage("Project cancelled. Any section already demolished remains empty.");
  };

  return (
    <div className="flex h-full min-h-[620px] flex-col overflow-hidden rounded-lg border-2 border-border bg-bg">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
        <div><p className="font-space-mono text-[7px] font-bold uppercase tracking-[.2em] text-accent">{teamId.toUpperCase()} · {stadiumProfile.name}</p><h2 className="font-anton text-[22px] uppercase leading-none text-text-primary">Stadium Builder</h2><p className="mt-1 text-[8px] text-text-secondary">{stadiumProfile.association} · {integer(stadiumProfile.capacity)} seats · opened {stadiumProfile.opened}</p></div>
        <button type="button" onClick={() => setShowPlans(true)} className="shrink-0 rounded border border-accent/50 px-2.5 py-1.5 font-space-mono text-[7px] font-bold uppercase text-accent hover:bg-accent/10">Plans ({plans.length})</button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(440px,1.2fr)_minmax(310px,.8fr)] xl:overflow-hidden">
        <section className="flex min-h-[520px] flex-col border-b border-border p-4 xl:min-h-0 xl:border-b-0 xl:border-r [&>div:nth-child(3)]:hidden">
          <div className="mb-2 flex items-center justify-between gap-2"><div><h3 className="font-anton text-base uppercase text-text-primary">{viewMode === "plan" ? `${stadiumProfile.name} plan` : `${stadiumProfile.name} viewer`}</h3><p className="text-[9px] text-text-secondary">Choose up to four adjacent sections.</p></div><div className="flex items-center gap-2">{teamId.toUpperCase() === "KKR" && <button type="button" onClick={() => setViewMode((mode) => mode === "plan" ? "viewer" : "plan")} className="rounded border border-accent/60 px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-accent">{viewMode === "plan" ? "Stadium viewer" : "Plan view"}</button>}<button type="button" onClick={() => setSelected([])} className="font-space-mono text-[7px] font-bold uppercase text-text-secondary hover:text-accent">Clear selection</button></div></div>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#17241c]">
            <svg viewBox="0 0 400 400" className={`h-full w-full ${viewMode === "viewer" ? "hidden" : ""}`} role="img" aria-label={`Interactive top-down plan of ${stadiumProfile.name}`}>
              <defs><radialGradient id="eden-grass"><stop offset="0" stopColor="#4c9a5b"/><stop offset="1" stopColor="#24663d"/></radialGradient></defs>
              <circle cx="200" cy="200" r="110" fill="url(#eden-grass)" stroke="#d9d394" strokeWidth="2"/>
              <circle cx="200" cy="200" r="104" fill="none" stroke="rgba(255,255,255,.25)" strokeDasharray="4 4"/>
              {Array.from({ length: Math.max(1, Math.min(5, pitchCount)) }, (_, index) => {
                const spacing = 9; const x = 200 + (index - (Math.min(5, pitchCount) - 1) / 2) * spacing;
                return <rect key={index} x={x - 3} y="169" width="6" height="62" rx="1" fill={index % 2 ? "#b9a36b" : "#c8b47b"} stroke="rgba(30,25,15,.35)"/>;
              })}
              {Array.from(new Set(modules.map((entry) => entry.standName))).flatMap((name) => { const ids = modules.filter((entry) => entry.standName === name).map((entry) => entry.id); const linked = modules.find((entry) => entry.standName === name && !entry.empty); return ids.slice(0, -1).map((id) => <g key={`link-${name}-${id}`} pointerEvents="none"><path d={standConnector(id, modules.length)} fill={linked ? template(linked.templateId).color : "#292929"} stroke="rgba(255,255,255,.45)" strokeWidth="1"/><path d={standArc(id, modules.length, 128)} fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1"/><path d={standArc(id, modules.length, 139)} fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1"/></g>); })}
              {modules.map((entry) => {
                const chosen = selected.includes(entry.id);
                const involved = activeProject?.moduleIds.includes(entry.id) && !["completed", "cancelled"].includes(activeProject.phase);
                return <path key={entry.id} d={annularSegment(entry.id, modules.length)} fill={entry.empty ? "#292929" : involved ? "#d59b2d" : template(entry.templateId).color} stroke={chosen ? "#f6c744" : "rgba(255,255,255,.34)"} strokeWidth={chosen ? 5 : 1.5} className="cursor-pointer transition-all hover:brightness-125" onClick={() => toggleModule(entry.id)}><title>{entry.standName} · Module {entry.id + 1} · {integer(entry.capacity)} seats</title></path>;
              })}
              {modules.map((entry) => { const tiers = entry.empty ? 0 : Math.max(1, template(entry.templateId).tiers); return <g key={`detail-${entry.id}`} pointerEvents="none">{Array.from({ length: tiers }, (_, tier) => <path key={tier} d={standArc(entry.id, modules.length, 126 + tier * 11)} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.2"/>)}{!entry.empty && entry.roof !== "None" && <path d={standArc(entry.id, modules.length, 176)} fill="none" stroke="rgba(236,214,138,.8)" strokeWidth={entry.roof === "Landmark roof" ? 4 : 2.5}/>}</g>; })}
              {standLabels.map((label) => <text key={label.name} x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="5.5" fontWeight="700" pointerEvents="none">{shortStandName(label.name)}</text>)}
            </svg>
            {viewMode === "viewer" && teamId.toUpperCase() === "KKR" && <div className="absolute inset-0 z-20"><EdenGardensViewer3D project={activeProject} modules={modules} selected={selected} activeModuleIds={activeProject && !["completed", "cancelled"].includes(activeProject.phase) ? activeProject.moduleIds : undefined} onToggleModule={toggleModule}/></div>}
            {viewMode === "viewer" && <div className="absolute inset-0 bg-[#17241c]"><svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label={`In-ground view of ${stadiumProfile.name}`}><defs><linearGradient id="viewer-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#243a5d"/><stop offset=".6" stopColor="#8aa8b8"/><stop offset=".61" stopColor="#315c3c"/><stop offset="1" stopColor="#172a1d"/></linearGradient></defs><rect width="400" height="400" fill="url(#viewer-sky)"/><ellipse cx="200" cy="325" rx="175" ry="34" fill="#23452d"/><path d="M25 280 Q200 225 375 280 L365 330 Q200 285 35 330 Z" fill="#4d7b51"/><path d="M35 235 Q200 165 365 235 L355 285 Q200 225 45 285 Z" fill="#4b2860" stroke="#d9b94e" strokeWidth="2"/><path d="M55 190 Q200 125 345 190 L335 235 Q200 180 65 235 Z" fill="#663678" stroke="#d9b94e" strokeWidth="2"/><path d="M85 146 Q200 92 315 146 L305 190 Q200 145 95 190 Z" fill="#82458f" stroke="#d9b94e" strokeWidth="2"/>{modules.slice(0, 12).map((entry, index) => { const chosen = selected.includes(entry.id); const x = 42 + index * 28; const h = 36 + template(entry.templateId).tiers * 7; return <g key={`viewer-${entry.id}`} onClick={() => toggleModule(entry.id)} className="cursor-pointer"><path d={`M ${x} ${250 - h} L ${x + 23} ${250 - h} L ${x + 27} 285 L ${x - 4} 285 Z`} fill={entry.empty ? "#292929" : template(entry.templateId).color} stroke={chosen ? "#f6c744" : "rgba(255,255,255,.45)"} strokeWidth={chosen ? 3 : 1}/><text x={x + 11} y={246 - h} textAnchor="middle" fill="white" fontSize="5" fontWeight="700" pointerEvents="none">{shortStandName(entry.standName)}</text><title>{entry.standName} · Module {entry.id + 1}</title></g>; })}<path d="M 110 305 Q200 290 290 305 L280 353 Q200 365 120 353 Z" fill="#4b914f" stroke="#d9d394" strokeWidth="2"/><text x="200" y="336" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">PITCH</text></svg></div>}
            <p className="pointer-events-none absolute inset-x-0 top-1 text-center font-space-mono text-[8px] font-bold uppercase tracking-wider text-white/80">{stadiumProfile.ends[0]}</p><p className="pointer-events-none absolute inset-x-0 bottom-1 text-center font-space-mono text-[8px] font-bold uppercase tracking-wider text-white/80">{stadiumProfile.ends[1]}</p>
            {selectedModules.length > 0 && <div className="absolute bottom-2 left-2 max-h-40 w-[min(250px,calc(100%-1rem))] overflow-y-auto rounded-lg border border-accent/60 bg-[#101713]/95 p-2 shadow-xl backdrop-blur-sm"><div className="sticky top-0 z-10 flex items-center justify-between bg-[#101713]/95 pb-1"><div><p className="font-space-mono text-[6px] font-bold uppercase tracking-widest text-accent">Selected stand{selectedModules.length > 1 ? "s" : ""}</p><p className="text-[7px] text-text-secondary">Scroll for all selected sections</p></div><button type="button" onClick={() => setSelected([])} className="rounded border border-white/20 px-1.5 py-0.5 font-space-mono text-[6px] uppercase text-white/70 hover:text-accent">Close</button></div><div className="mt-1 space-y-1">{selectedModules.map((entry) => <div key={entry.id} className="rounded border border-white/15 bg-white/5 px-1.5 py-1"><div className="flex items-center justify-between gap-1"><p className="truncate text-[8px] font-bold text-white">{entry.standName} · M{entry.id + 1}</p><p className="font-anton text-xs text-accent">{integer(entry.capacity)}</p></div><p className="text-[6px] text-white/65">Fans {entry.fanOpinion}/100 · Condition {Math.round(entry.condition)}/100 · {template(entry.templateId).name}</p></div>)}</div></div>}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{selectedModules.map((entry) => <article key={entry.id} className="rounded border border-accent/30 bg-surface p-2"><p className="truncate text-[9px] font-bold text-text-primary">{entry.standName}</p><p className="font-space-mono text-[6px] uppercase text-text-secondary">Module {entry.id + 1} · {template(entry.templateId).tiers} tiers</p><p className="mt-1 font-anton text-sm text-accent">{integer(entry.capacity)}</p></article>)}</div>
        </section>

        <section className="overflow-y-auto border-b border-border p-4 xl:border-b-0 xl:border-r [&>div:first-child]:hidden">
          <div className="mb-4 rounded border border-border bg-surface p-3"><div className="flex items-center justify-between"><h3 className="font-anton text-base uppercase text-text-primary">Stadium stats</h3><span className="font-space-mono text-[7px] uppercase text-text-secondary">{selected.length ? `${selected.length} selected` : "No selection"}</span></div><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><div><p className="font-space-mono text-[6px] uppercase text-text-secondary">Stadium before</p><p className="font-anton text-sm text-text-primary">{integer(totalCapacity)}</p></div><div><p className="font-space-mono text-[6px] uppercase text-text-secondary">Sections before</p><p className="font-anton text-sm text-text-primary">{integer(selectedCapacity)}</p></div><div><p className="font-space-mono text-[6px] uppercase text-text-secondary">Sections after</p><p className={`font-anton text-sm ${newCapacity >= selectedCapacity ? "text-success" : "text-danger"}`}>{integer(newCapacity)}</p></div><div><p className="font-space-mono text-[6px] uppercase text-text-secondary">Stadium after</p><p className={`font-anton text-sm ${projectedCapacity >= totalCapacity ? "text-success" : "text-danger"}`}>{integer(projectedCapacity)}</p></div></div><p className="mt-2 text-[8px] leading-relaxed text-text-secondary">{selected.length ? changeReason : "Select adjacent sections to preview capacity changes and why they occur."}</p>{selected.length > 0 && <p className="mt-1 font-space-mono text-[7px] uppercase text-text-secondary">Selected change: <span className={newCapacity - selectedCapacity >= 0 ? "text-success" : "text-danger"}>{newCapacity - selectedCapacity >= 0 ? "+" : ""}{integer(newCapacity - selectedCapacity)} seats</span></p>}{selectedModules.length > 0 && <div className="mt-3 border-t border-border pt-2"><p className="mb-2 font-space-mono text-[7px] font-bold uppercase text-accent">Selected stand details</p><div className="space-y-2">{selectedModules.map((entry) => <div key={entry.id} className="rounded border border-accent/25 p-2"><div className="flex items-center justify-between gap-2"><p className="truncate text-[10px] font-bold text-text-primary">{entry.standName} · Module {entry.id + 1}</p><p className="font-anton text-sm text-accent">{integer(entry.capacity)} seats</p></div><div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[7px] text-text-secondary sm:grid-cols-4"><span>Fan favouritism <b className="text-text-primary">{entry.fanOpinion}/100</b></span><span>Condition <b className="text-text-primary">{Math.round(entry.condition)}/100</b></span><span>Type <b className="text-text-primary">{template(entry.templateId).name}</b></span><span>Built/refurbished <b className="text-text-primary">{entry.constructionYear}/{entry.lastRefurbishedYear}</b></span></div></div>)}</div></div>}</div>
          <div className="mb-3 flex items-center gap-2"><Hammer size={15} className="text-accent"/><h3 className="font-anton text-base uppercase text-text-primary">Design a project</h3></div>
          <label className="block"><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Concept name</span><input value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="e.g. New Pavilion End" className="mt-1 w-full rounded border border-border bg-surface px-2 py-2 text-xs text-text-primary outline-none focus:border-accent"/></label>
          <div className="mt-3 grid grid-cols-2 gap-2">{(["replace", "add-tier", "refurbish", "demolish"] as Action[]).map((value) => <button type="button" key={value} onClick={() => setAction(value)} className={`rounded border px-2 py-2 font-space-mono text-[7px] font-bold uppercase ${action === value ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-text-secondary"}`}>{value.replace("-", " ")}</button>)}</div>
          {action !== "demolish" && <><label className="mt-3 block"><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Stand template</span><select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-1 w-full rounded border border-border bg-surface px-2 py-2 text-xs text-text-primary">{TEMPLATES.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.tiers} tier{entry.tiers === 1 ? "" : "s"}</option>)}</select></label><div className="mt-3 grid grid-cols-2 gap-2"><label><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Quality</span><select value={quality} onChange={(event) => setQuality(event.target.value as Quality)} className="mt-1 w-full rounded border border-border bg-surface px-2 py-2 text-xs text-text-primary">{Object.keys(QUALITY_MULTIPLIER).map((entry) => <option key={entry}>{entry}</option>)}</select></label><label><span className="font-space-mono text-[7px] font-bold uppercase text-text-secondary">Roof</span><select value={roof} onChange={(event) => setRoof(event.target.value as Roof)} className="mt-1 w-full rounded border border-border bg-surface px-2 py-2 text-xs text-text-primary">{Object.keys(ROOF_PRICE).map((entry) => <option key={entry}>{entry}</option>)}</select></label></div></>}
          <div className="mt-4 grid grid-cols-2 gap-2">{[["Nominal price", money(priceCrore)], ["Capacity change", `${newCapacity - oldCapacity >= 0 ? "+" : ""}${integer(newCapacity - oldCapacity)}`], ["Demolition", `${demolitionDays} days`], ["Construction", `${constructionDays} days`], ["Fan preview", `${fanReaction > 0 ? "+" : ""}${fanReaction}`], ["Modules", String(selected.length)]].map(([label, value]) => <div key={label} className="rounded border border-border bg-surface p-2"><p className="font-space-mono text-[6px] uppercase text-text-secondary">{label}</p><p className="mt-1 font-anton text-sm text-text-primary">{value}</p></div>)}</div>
          {message && <p className="mt-3 rounded border border-accent/25 bg-accent/5 p-2 text-[9px] text-text-secondary">{message}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={createPlan} className="flex items-center justify-center gap-2 rounded border border-accent px-3 py-2.5 font-space-mono text-[8px] font-bold uppercase text-accent hover:bg-accent/10"><Save size={13}/>Save plan</button><button type="button" onClick={putIntoConstruction} className="flex items-center justify-center gap-2 rounded bg-accent px-3 py-2.5 font-space-mono text-[8px] font-bold uppercase text-black"><Building2 size={13}/>Build now</button></div>
          {activeProject && <div className="mt-4 rounded border border-accent/40 bg-accent/5 p-3"><p className="font-space-mono text-[7px] font-bold uppercase text-accent">Current project · {activeProject.phase}</p><p className="font-anton text-base uppercase text-text-primary">{activeProject.name}</p><p className="mt-1 text-[8px] text-text-secondary">Completes {activeProject.constructionCompletesOn}</p>{!["completed", "cancelled"].includes(activeProject.phase) && <button type="button" onClick={cancelProject} className="mt-2 w-full rounded border border-danger/40 py-1 font-space-mono text-[7px] font-bold uppercase text-danger">Cancel project</button>}</div>}
        </section>

        <section className="hidden">
          <div className="flex items-center gap-2"><Layers3 size={15} className="text-accent"/><h3 className="font-anton text-base uppercase text-text-primary">Plan library</h3></div>
          {activeProject && <article className="mt-3 rounded border-2 border-accent/40 bg-accent/5 p-3"><div className="flex justify-between gap-2"><div><p className="font-space-mono text-[6px] font-bold uppercase text-accent">Current project · {activeProject.phase}</p><h4 className="font-anton text-base uppercase text-text-primary">{activeProject.name}</h4></div><CalendarClock size={16} className="text-accent"/></div><div className="mt-2 grid grid-cols-2 gap-2 text-[8px] text-text-secondary"><span>Started {activeProject.startedOn}</span><span>Final date {activeProject.constructionCompletesOn}</span>{activeProject.demolitionCompletesOn && <span>Demolition done {activeProject.demolitionCompletesOn}</span>}{activeProject.constructionStartsOn && <span>Build starts {activeProject.constructionStartsOn}</span>}</div>{!["completed", "cancelled"].includes(activeProject.phase) && <button type="button" onClick={cancelProject} className="mt-3 w-full rounded border border-danger/40 py-1.5 font-space-mono text-[7px] font-bold uppercase text-danger">Cancel project</button>}</article>}
          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{plans.length === 0 ? <div className="flex h-32 items-center justify-center rounded border border-dashed border-border p-5 text-center text-[9px] text-text-secondary">Select stadium sections and save a concept to compare future options.</div> : plans.map((plan) => <article key={plan.id} className="rounded border border-border bg-surface p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="truncate text-xs font-bold text-text-primary">{plan.name}</h4><p className="font-space-mono text-[6px] uppercase text-text-secondary">{plan.action.replace("-", " ")} · Modules {plan.moduleIds.map((id) => id + 1).join(", ")}</p></div><button type="button" onClick={() => setPlans((current) => current.filter((entry) => entry.id !== plan.id))} className="text-text-secondary hover:text-danger" aria-label={`Delete ${plan.name}`}><Trash2 size={13}/></button></div><div className="mt-2 flex items-end justify-between"><div><p className="font-anton text-sm text-accent">{money(plan.priceCrore)}</p><p className="text-[7px] text-text-secondary">{plan.capacityDelta >= 0 ? "+" : ""}{integer(plan.capacityDelta)} seats · {plan.demolitionDays + plan.constructionDays} days</p></div><button type="button" onClick={() => startProject(plan)} disabled={Boolean(activeProject && !["completed", "cancelled"].includes(activeProject.phase))} className="rounded bg-text-primary px-2 py-1.5 font-space-mono text-[6px] font-bold uppercase text-bg disabled:opacity-30"><Building2 size={10} className="mr-1 inline"/>Start</button></div></article>)}{projectHistory.length > 0 && <div className="pt-2"><p className="mb-2 font-space-mono text-[7px] font-bold uppercase text-text-secondary">Project history</p>{projectHistory.map((project) => <div key={project.id} className="mb-1 flex justify-between rounded border border-border/70 px-2 py-1.5 text-[8px]"><span className="truncate text-text-primary">{project.name}</span><span className={project.phase === "completed" ? "text-success" : "text-danger"}>{project.phase}</span></div>)}</div>}</div>
        </section>
      </div>
      {showPlans && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label="Saved stadium plans"><div className="w-full max-w-lg rounded-lg border-2 border-border bg-bg shadow-2xl"><div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3"><div className="flex items-center gap-2"><Layers3 size={15} className="text-accent"/><h3 className="font-anton text-base uppercase text-text-primary">Saved plans</h3></div><button type="button" onClick={() => setShowPlans(false)} className="rounded border border-border px-2 py-1 font-space-mono text-[7px] font-bold uppercase text-text-secondary">Close</button></div><div className="max-h-[65vh] space-y-2 overflow-y-auto p-4">{plans.length === 0 ? <p className="rounded border border-dashed border-border p-6 text-center text-[9px] text-text-secondary">No proposed plans saved yet.</p> : plans.map((plan) => <div key={plan.id} className="flex items-center justify-between rounded border border-border bg-surface p-3"><div><p className="text-xs font-bold text-text-primary">{plan.name}</p><p className="font-space-mono text-[7px] uppercase text-text-secondary">{plan.action.replace("-", " ")} · Modules {plan.moduleIds.map((id) => id + 1).join(", ")}</p><p className="mt-1 font-anton text-sm text-accent">{money(plan.priceCrore)}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => { startProject(plan); setShowPlans(false); }} disabled={Boolean(activeProject && !["completed", "cancelled"].includes(activeProject.phase))} className="rounded bg-text-primary px-2 py-1.5 font-space-mono text-[6px] font-bold uppercase text-bg disabled:opacity-30">Start</button><button type="button" onClick={() => setPlans((current) => current.filter((entry) => entry.id !== plan.id))} className="text-text-secondary hover:text-danger" aria-label={`Delete ${plan.name}`}><Trash2 size={13}/></button></div></div>)}</div></div></div>}
    </div>
  );
}
