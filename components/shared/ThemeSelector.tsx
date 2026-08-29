"use client";

import { Moon, Palette, Radio, Sun } from "lucide-react";
import type { AppearanceTheme } from "@/lib/theme/appearance";

const OPTIONS: Array<{
  value: AppearanceTheme;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "retro", label: "Retro", icon: Radio },
  { value: "team", label: "Team", icon: Palette },
];

type ThemeSelectorProps = {
  value: AppearanceTheme;
  onChange: (theme: AppearanceTheme) => void;
};

export default function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Interface theme"
      className="theme-selector grid grid-cols-4 overflow-hidden rounded border border-[var(--ink)] bg-bg"
    >
      {OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 border-r border-[var(--ink)] px-1.5 py-2 font-space-mono text-[8px] font-bold uppercase tracking-wide transition-colors last:border-r-0 ${
              selected
                ? "bg-[var(--ink)] text-[var(--surface)]"
                : "bg-surface text-text-secondary hover:bg-[var(--ink)]/5 hover:text-text-primary"
            }`}
            title={`Use ${label} theme`}
          >
            <Icon size={12} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
