"use client";

import { useId, useMemo } from "react";
import type { CuratorPitch } from "@/lib/data/pitchCurator";
import { pitchCondition, type PitchPreparation } from "@/lib/logic/pitchPreparation";

// Dimensions in inches, from the IPL playing conditions and Appendix C.
const HALF_PITCH_LENGTH = (22 * 36) / 2;
const HALF_PITCH_WIDTH = (10 * 12) / 2;
const POPPING_CREASE = 4 * 12;
const HALF_POPPING_LENGTH = 15 * 36;
const RETURN_OFFSET = 4 * 12 + 4;
const RETURN_LENGTH = 8 * 12;
const WIDE_OFFSET = RETURN_OFFSET - 17;
const PROTECTED_START = POPPING_CREASE + 5 * 12;
const PROTECTED_OFFSET = 12;
const PROTECTED_MARK_LENGTH = 9;
const PAINT_WIDTH = 1.25;
const STRIP_END = HALF_PITCH_LENGTH + RETURN_LENGTH - POPPING_CREASE;
const STRIP = { x: -STRIP_END, y: -HALF_PITCH_WIDTH, width: 2 * STRIP_END, height: 2 * HALF_PITCH_WIDTH };
const STUMP_RADIUS = 0.75;
const STUMP_SPACING = 9 / 2 - STUMP_RADIUS;

const SURFACE_STYLES = {
  batting:  { grass: 0.35, dust: 0.18, cracks: 0.04, polish: 0.85 },
  pace:     { grass: 0.62, dust: 0.20, cracks: 0.08, polish: 0.68 },
  seam:     { grass: 1.25, dust: 0.08, cracks: 0.04, polish: 0.28 },
  balanced: { grass: 0.76, dust: 0.34, cracks: 0.14, polish: 0.48 },
  turner:   { grass: 0.43, dust: 0.78, cracks: 0.36, polish: 0.20 },
  cracked:  { grass: 0.39, dust: 0.66, cracks: 0.85, polish: 0.12 },
} as const;

const SURFACE_STYLE_BY_TYPE: Partial<Record<string, readonly [keyof typeof SURFACE_STYLES, string]>> = {
  "Flat Track": ["batting", "#d4a574"],
  "Hard Flat Deck": ["batting", "#d7b78e"],
  "Ultra-Flat Track": ["batting", "#e4c093"],
  "Belter": ["batting", "#d99962"],
  "Ultra-Flat Batting Track": ["batting", "#e1b380"],
  "Flat Batting Track": ["batting", "#c99464"],
  "Hard Red Soil with High Bounce": ["pace", "#bd6948"],
  "Hard and Bouncy": ["pace", "#b37357"],
  "High Bounce and Pace": ["pace", "#a95740"],
  "High Pace and Bounce": ["pace", "#b87951"],
  "Green and Moist": ["seam", "#547544"],
  "Seam Friendly": ["seam", "#71844b"],
  "Grass and Seam Friendly": ["seam", "#638346"],
  "Balanced Clay": ["balanced", "#927355"],
  "Even Contest": ["balanced", "#aa8666"],
  "Balanced True-Bounce Surface": ["balanced", "#b59872"],
  "Balanced Contest": ["balanced", "#a18465"],
  "Slow and Dry": ["turner", "#b29c77"],
  "Turn and Bounce": ["turner", "#c08359"],
  "Traditional Dry and Low": ["turner", "#c4a77e"],
  "Low and Slow": ["turner", "#80705b"],
  "Low and Gripping": ["turner", "#958270"],
  "Low Bounce and Spin": ["turner", "#a08b6c"],
  "Low and Dry": ["turner", "#bba784"],
  "Extreme Spin and Grip": ["turner", "#9f8b75"],
  "Dry and Spin Friendly": ["turner", "#c09c71"],
  "Slow and Difficult to Time": ["turner", "#a89376"],
  "Dry and Cracked": ["cracked", "#bda78d"],
  "Variable and Uneven": ["cracked", "#aa9075"],
  "Dry, Worn and Low Scoring": ["cracked", "#c7aa80"],
};

function surfaceSeed(pitchId: string) {
  let seed = 2166136261;
  for (let index = 0; index < pitchId.length; index++) {
    seed = Math.imul(seed ^ pitchId.charCodeAt(index), 16777619);
  }
  return seed >>> 0;
}

function createCracks(seed: number) {
  // Preparation changes how strongly the cracks show, while the layout stays with the pitch.
  let state = seed;
  const between = (min: number, max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return min + (max - min) * (state / 4294967296);
  };
  const point = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  return Array.from({ length: Math.floor(between(8, 15)) }, () => {
    let x = between(STRIP.x + 20, STRIP.x + STRIP.width - 20);
    let y = between(-46, 46);
    let angle = between(0, 2 * Math.PI);
    const segments = Math.floor(between(3, 8));
    let main = `M${point(x, y)}`;
    let branches = "";
    for (let segment = 0; segment < segments; segment++) {
      const length = between(5, 15);
      angle += between(-0.85, 0.85);
      x += Math.cos(angle) * length;
      y += Math.sin(angle) * length;
      main += `L${point(x, y)}`;

      if (segment > 0 && segment < segments - 1 && between(0, 1) < 0.36) {
        const branchAngle = angle + between(0.8, 1.75) * (between(0, 1) < 0.5 ? -1 : 1);
        const branchLength = between(5, 12);
        const endX = x + Math.cos(branchAngle) * branchLength;
        const endY = y + Math.sin(branchAngle) * branchLength;
        const tipAngle = branchAngle + between(-0.65, 0.65);
        branches += `M${point(x, y)}L${point(endX, endY)}L${point(endX + Math.cos(tipAngle) * 4, endY + Math.sin(tipAngle) * 4)}`;
      }
    }
    return { main, branches, width: between(0.65, 1.35) };
  });
}

function PitchEnd({ direction }: { direction: 1 | -1 }) {
  return (
    <g transform={`translate(${-direction * HALF_PITCH_LENGTH} 0) scale(${direction} 1)`}>
      <g fill="#fff7e5">
        {/* The back edges of the painted lines are the bowling and popping creases. */}
        <rect y={-RETURN_OFFSET} width={PAINT_WIDTH} height={2 * RETURN_OFFSET} />
        {/* The popping crease continues into the outfield beyond this close-up. */}
        <rect x={POPPING_CREASE} y={-HALF_POPPING_LENGTH} width={PAINT_WIDTH} height={2 * HALF_POPPING_LENGTH} />
        {[-1, 1].map(side => (
          <g key={side} transform={`scale(1 ${side})`}>
            {/* Return and wide positions are measured to the inside edges of the paint. */}
            <rect x={POPPING_CREASE - RETURN_LENGTH} y={RETURN_OFFSET} width={RETURN_LENGTH} height={PAINT_WIDTH} />
            <rect x={PAINT_WIDTH} y={WIDE_OFFSET} width={POPPING_CREASE - PAINT_WIDTH} height={PAINT_WIDTH} />
            <rect x={-PROTECTED_MARK_LENGTH} y={PROTECTED_OFFSET} width={PROTECTED_MARK_LENGTH} height={PAINT_WIDTH} />
            <rect x={PROTECTED_START} y={HALF_PITCH_WIDTH - PROTECTED_MARK_LENGTH} width={PAINT_WIDTH} height={PROTECTED_MARK_LENGTH} />
          </g>
        ))}
      </g>
      <g fill="#38bdf8" stroke="#082f49" strokeWidth=".45">
        {[-STUMP_SPACING, 0, STUMP_SPACING].map(y => <circle key={y} cy={y} r={STUMP_RADIUS} />)}
      </g>
      {[-STUMP_SPACING / 2, STUMP_SPACING / 2].map(y => (
        <g key={y} transform={`translate(0 ${y})`}>
          <path d="M0 -2.155v4.31" stroke="#075985" strokeWidth=".55" />
          <rect x="-.47" y="-1.065" width=".94" height="2.13" rx=".22" fill="#67e8f9" stroke="#082f49" strokeWidth=".3" />
        </g>
      ))}
    </g>
  );
}

/** Surface textures illustrate whole-pitch condition and carry no simulation data. */
export default function PitchSurfaceVisual({ pitch, preparation, date, projected = false, compact = false }: {
  pitch: CuratorPitch;
  preparation?: PitchPreparation;
  date: string;
  projected?: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const seed = surfaceSeed(pitch.id);
  const cracks = useMemo(() => createCracks(seed), [seed]);
  const { soil, sliders } = pitchCondition(pitch, preparation, date);
  const [family, tint] = SURFACE_STYLE_BY_TYPE[pitch.type] ?? ["balanced", "#a48563"];
  const style = SURFACE_STYLES[family];
  const clay = soil === "black" ? { light: "#8c7967", dark: "#56483c" } : { light: "#cf9d75", dark: "#8f5d42" };
  const grass = sliders.grassCover / 10;
  const moisture = sliders.moisture / 10;
  const wear = sliders.surfaceWear / 10;
  const firmness = sliders.compaction / 10;
  const unevenness = 1 - sliders.consistency / 10;
  const turfCover = Math.min(1, grass * style.grass);
  const dust = (1 - moisture) * (0.3 + wear * 0.7) * style.dust;
  const fissures = (1 - moisture) * (style.cracks + 0.32 * wear) * (1 - firmness * 0.45);
  const polish = (0.14 + style.polish * 0.32) * firmness * (1 - unevenness);
  const label = (value: number) => value < 4 ? "low" : value >= 7 ? "high" : "moderate";
  const paint = (name: string) => `url(#${id}-${name})`;

  return (
    <section className={compact ? "min-w-0" : "min-w-0 lg:col-span-2"} aria-label="Pitch surface visualisation">
      <svg viewBox="-480 -77.5 960 155" role="img" aria-label={`${pitch.name}, ${projected ? "projected matchday" : compact ? "example" : "current"} surface. ${pitch.type}, ${soil} soil, ${label(sliders.grassCover)} grass cover, ${label(sliders.moisture)} moisture and ${label(sliders.surfaceWear)} wear.`} className={`block h-auto w-full overflow-hidden bg-[#204e37] ${compact ? "" : "lg:h-[230px]"}`}>
        <defs>
          <pattern id={`${id}-outfield`} width="56" height="180" patternUnits="userSpaceOnUse">
            <rect width="28" height="180" fill="#fff" opacity=".035" />
          </pattern>
          <linearGradient id={`${id}-soil`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop stopColor={clay.dark} />
            <stop offset=".17" stopColor={clay.light} />
            <stop offset=".76" stopColor={clay.light} />
            <stop offset="1" stopColor={clay.dark} />
          </linearGradient>
          <radialGradient id={`${id}-dust`}>
            <stop stopColor="#efcf9d" />
            <stop offset="1" stopColor="#efcf9d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-roll`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#fff2d0" stopOpacity="0" />
            <stop offset=".46" stopColor="#fff2d0" />
            <stop offset=".7" stopColor="#fff2d0" stopOpacity=".45" />
            <stop offset="1" stopColor="#fff2d0" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}-strip`}><rect {...STRIP} /></clipPath>
          <filter id={`${id}-turf`} {...STRIP} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            {/* Blend irregular tufts with fine grain, then expose more of them as cover increases. */}
            <feTurbulence type="fractalNoise" baseFrequency=".035 .055" numOctaves="3" seed={seed % 997 + 1} result="patches" />
            <feTurbulence type="fractalNoise" baseFrequency=".4 .46" numOctaves="2" seed={seed % 997 + 2} result="flecks" />
            <feComposite in="patches" in2="flecks" operator="arithmetic" k2=".68" k3=".32" />
            <feColorMatrix type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 ${-2.85 + 1.75 * turfCover}`} result="cover" />
            <feFlood floodColor="#506e42" result="turfColour" />
            <feComposite in="turfColour" in2="cover" operator="in" />
          </filter>
          <filter id={`${id}-grain`} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency=".13 .26" numOctaves="3" seed="7" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect x="-100%" y="-100%" width="200%" height="200%" fill={paint("outfield")} />
        <rect {...STRIP} fill={paint("soil")} />
        <rect {...STRIP} fill={tint} opacity=".38" />
        <rect {...STRIP} fill="#302a23" opacity={0.36 * moisture ** 1.5} />
        <rect {...STRIP} fill="#60804b" opacity={0.2 * turfCover} />
        <rect {...STRIP} filter={paint("grain")} style={{ mixBlendMode: "multiply" }} opacity={(0.12 + 0.35 * unevenness + 0.15 * wear) * (1 - firmness * 0.45)} />
        <rect {...STRIP} fill={paint("roll")} opacity={polish} />
        <rect {...STRIP} fill="transparent" filter={paint("turf")} />
        <g fill={paint("dust")}>
          <ellipse cx="-108" cy="-25" rx="183" ry="28" opacity={dust * 0.65} />
          <ellipse cx="132" cy="21" rx="159" ry="26" opacity={dust * 0.8} />
          <ellipse cx="-369" cy="25" rx="53" ry="20" opacity={dust + wear * 0.14} />
          <ellipse cx="369" cy="-25" rx="53" ry="20" opacity={dust + wear * 0.14} />
        </g>
        <g clipPath={paint("strip")} fill="none" stroke="#30241d" strokeLinecap="round" strokeLinejoin="round" opacity={fissures}>
          {cracks.map(({ main, branches, width }) => (
            <g key={main}>
              <path d={main} strokeWidth={width + wear * 0.45} />
              {branches && <path d={branches} strokeWidth={width * 0.55} />}
            </g>
          ))}
        </g>
        <PitchEnd direction={1} />
        <PitchEnd direction={-1} />
      </svg>
    </section>
  );
}
