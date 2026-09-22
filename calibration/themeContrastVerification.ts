import assert from "node:assert/strict";
import { TEAM_THEMES, readableAccentOn, readableOn } from "../lib/theme/teams";

const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};
const contrast = (left: string, right: string) => {
  const brighter = Math.max(luminance(left), luminance(right));
  const darker = Math.min(luminance(left), luminance(right));
  return (brighter + 0.05) / (darker + 0.05);
};

for (const theme of Object.values(TEAM_THEMES)) {
  const surface = `#${[1, 3, 5].map((offset) => Math.round(Number.parseInt("#191d27".slice(offset, offset + 2), 16) * 0.89
    + Number.parseInt(theme.accent.slice(offset, offset + 2), 16) * 0.11).toString(16).padStart(2, "0")).join("")}`;
  const surface2 = `#${[1, 3, 5].map((offset) => Math.round(Number.parseInt("#232834".slice(offset, offset + 2), 16) * 0.88
    + Number.parseInt(theme.accent.slice(offset, offset + 2), 16) * 0.12).toString(16).padStart(2, "0")).join("")}`;
  const label = readableAccentOn(theme.accent, surface2);
  assert.ok(contrast(label, surface) >= 4.5, `${theme.code} surface accent label`);
  assert.ok(contrast(label, surface2) >= 4.5, `${theme.code} raised surface accent label`);
  assert.ok(contrast(readableOn(theme.accent), theme.accent) >= 4.5, `${theme.code} filled accent`);
}

assert.ok(contrast(readableAccentOn("#ffc400", "#f4f1ea"), "#f4f1ea") >= 4.5, "light theme accent label");
assert.ok(contrast(readableAccentOn("#ffc400", "#171a25"), "#171a25") >= 4.5, "dark theme accent label");
assert.ok(contrast("#665f55", "#f4f1ea") >= 4.5, "light theme secondary text");
assert.ok(contrast("#765019", "#d8d0b6") >= 4.5, "retro accent label");
console.log("Theme accent contrast verification passed.");
