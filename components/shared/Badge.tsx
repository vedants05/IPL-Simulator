import type { ReactNode } from "react";

// Shared informational tag used across the auction/squad/overview screens.
// These markers are deliberately NOT team-branded — a tag whose colour tracks
// the picked franchise reads as a bug, not a feature — so overseas/rtm sit on
// one neutral slate, matching the `.tag` shape in the redesign concept
// (Space Mono, uppercase, --radius-sm, tinted background + solid text).
export type BadgeVariant = "overseas" | "rtm" | "retain";

const VARIANT_STYLES: Record<BadgeVariant, { label: string; className: string }> = {
  overseas: { label: "OS", className: "bg-[#5a6b8c]/15 text-[#5a6b8c]" },
  rtm: { label: "RTM", className: "bg-[#5a6b8c]/15 text-[#5a6b8c]" },
  // "Retained" carries a distinct, still-neutral warm tone so it reads apart
  // from the slate informational tags without borrowing the team colour.
  retain: { label: "RTN", className: "bg-[#8a6d3b]/15 text-[#8a6d3b]" },
};

interface BadgeProps {
  variant: BadgeVariant;
  /** Overrides the default label (e.g. a spelled-out "Overseas"). */
  children?: ReactNode;
  /** Extra classes for per-call sizing/margins (kept out of the base style). */
  className?: string;
  title?: string;
}

export default function Badge({ variant, children, className = "", title }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex shrink-0 items-center rounded-sm px-1 py-0.5 font-space-mono font-bold uppercase leading-none tracking-wide ${v.className} ${className}`}
    >
      {children ?? v.label}
    </span>
  );
}
