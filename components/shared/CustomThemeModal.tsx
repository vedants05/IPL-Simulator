"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Palette, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import {
  COLOUR_FIELDS, CUSTOM_PRESETS, contrastRatio, getStoredCustomPalette,
  hexToHsv, hsvToHex, saveCustomPalette, type ColourKey, type CustomPalette,
} from "@/lib/theme/custom";
import { readableOn } from "@/lib/theme/teams";
import "./custom-theme.css";

function ColourWheel({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hex, setHex] = useState(value.toUpperCase());
  useEffect(() => {
    setHex(value.toUpperCase());
    setHsv(previous => hsvToHex(...previous).toLowerCase() === value.toLowerCase() ? previous : hexToHsv(value));
  }, [value]);
  const [h, s, v] = hsv;
  const update = (next: [number, number, number]) => { setHsv(next); onChange(hsvToHex(...next)); };
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
    const y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2);
    update([(Math.atan2(y, x) * 180 / Math.PI + 360) % 360, Math.min(1, Math.hypot(x, y)), v]);
  };
  const validHex = /^#[0-9a-f]{6}$/i.test(hex);
  return <div className="ct-colour-editor">
    <div className="ct-wheel" role="slider" tabIndex={0} aria-label={`${label} colour wheel hue`}
      aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(h) % 360}
      aria-valuetext={`${Math.round(h)} degrees, ${Math.round(s * 100)}% saturation`}
      aria-describedby="ct-wheel-help"
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pick(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event); }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        if (event.key === "Home" || event.key === "End") update([event.key === "Home" ? 0 : 359, s, v]);
        else if (event.key === "ArrowLeft" || event.key === "ArrowRight") update([(h + (event.key === "ArrowRight" ? 1 : 359)) % 360, s, v]);
        else update([h, Math.max(0, Math.min(1, s + (event.key === "ArrowUp" ? 0.01 : -0.01))), v]);
      }}>
      <div className="ct-wheel-shade" style={{ opacity: 1 - v }} />
      <span className="ct-wheel-point" style={{ left: `${50 + Math.cos(h * Math.PI / 180) * s * 50}%`, top: `${50 + Math.sin(h * Math.PI / 180) * s * 50}%`, background: value }} />
    </div>
    <p id="ct-wheel-help" className="ct-hint" role="status">{validHex ? "Drag to pick a colour. Use the sliders for precise control." : "Use a six-digit HEX colour, e.g. #65A8FF."}</p>
    {([
      ["Hue", h, 359, (n: number) => update([n, s, v])],
      ["Saturation", s * 100, 100, (n: number) => update([h, n / 100, v])],
      ["Brightness", v * 100, 100, (n: number) => update([h, s, n / 100])],
    ] as const).map(([name, current, max, change]) => <label className="ct-slider" key={name}>
      <span>{name}<b>{Math.round(current)}{name === "Hue" ? "°" : "%"}</b></span>
      <input type="range" min={0} max={max} value={current} onChange={event => change(Number(event.target.value))} />
    </label>)}
    <label className="ct-hex"><span style={{ background: value }} aria-hidden="true" /><span>HEX</span>
      <input aria-label={`${label} HEX colour`} value={hex} spellCheck={false} maxLength={7} aria-invalid={!validHex}
        onChange={event => { const next = event.target.value; setHex(next); if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase()); }}
        onBlur={() => { if (!validHex) setHex(value.toUpperCase()); }} />
    </label>
  </div>;
}

function ThemePreview({ palette: p }: { palette: CustomPalette }) {
  return <div className="ct-preview" style={{ background: p.background, color: p.text, borderColor: p.border }}>
    <div className="ct-preview-nav" style={{ background: p.nav, color: p.navText, borderColor: p.border }}>
      <b>IPL MANAGER</b><span style={{ color: p.navMuted }}>Squad</span><span style={{ background: p.selection, color: p.navText }}>Home</span>
    </div>
    <div className="ct-preview-body">
      <div className="ct-preview-heading"><strong>Match centre</strong><span style={{ color: p.muted }}>Season 2027</span></div>
      <div className="ct-preview-card" style={{ background: p.surface, borderColor: p.border }}>
        <span style={{ color: p.muted }}>YOUR FRANCHISE</span><strong>Ready for the next innings.</strong>
        <div className="ct-preview-bars"><i style={{ background: p.primary, width: "76%" }} /><i style={{ background: p.secondary, width: "53%" }} /></div>
        <div className="ct-preview-stats" style={{ background: p.surface2, borderColor: p.border }}><span>Played <b>12</b></span><span>Points <b>18</b></span></div>
        <div className="ct-preview-actions"><span style={{ background: p.primary, color: readableOn(p.primary) }}>Continue →</span><span style={{ background: p.secondary, color: readableOn(p.secondary) }}>View squad</span></div>
      </div>
      <div className="ct-preview-note" style={{ background: p.highlight }}>Next fixture <b>Today · 19:30</b></div>
      <div className="ct-preview-status"><span style={{ color: p.success }}>● Available</span><span style={{ color: p.danger }}>● Injured</span></div>
    </div>
    <div className="ct-preview-footer" style={{ background: p.footer, color: p.muted, borderColor: p.border }}>Your colours, across the game.</div>
  </div>;
}

export default function CustomThemeModal({ onClose, onApply }: { onClose: () => void; onApply: () => void }) {
  const [palette, setPalette] = useState<CustomPalette>(getStoredCustomPalette);
  const [activeKey, setActiveKey] = useState<ColourKey>("primary");
  const [view, setView] = useState<"presets" | "colours">("presets");
  const [scale, setScale] = useState(() => Math.max(0.01, Math.min(1, (window.innerWidth - 24) / 1100, (window.innerHeight - 24) / 650)));
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const fit = () => setScale(Math.max(0.01, Math.min(1, (window.innerWidth - 24) / 1100, (window.innerHeight - 24) / 650)));
    fit();
    window.addEventListener("resize", fit);
    const previousFocus = document.activeElement as HTMLElement | null;
    const viewport = document.querySelector<HTMLElement>(".app-viewport");
    const wasInert = viewport?.inert;
    if (viewport) viewport.inert = true;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === "Tab") {
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("resize", fit);
      document.removeEventListener("keydown", keydown, true);
      if (viewport) viewport.inert = wasInert ?? false;
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);
  const selectedPreset = CUSTOM_PRESETS.find(preset => COLOUR_FIELDS.every(({ key }) => preset.colours[key].toLowerCase() === palette[key].toLowerCase()));
  const field = COLOUR_FIELDS.find(({ key }) => key === activeKey)!;
  const lowContrast = [
    ["Page text", palette.text, palette.background], ["Panel text", palette.text, palette.surface],
    ["Raised panel text", palette.text, palette.surface2], ["Secondary text", palette.muted, palette.surface],
    ["Navigation text", palette.navText, palette.nav], ["Inactive navigation", palette.navMuted, palette.nav],
    ["Selected navigation", palette.navText, palette.selection], ["Highlight text", palette.text, palette.highlight],
    ["Footer text", palette.muted, palette.footer],
  ].filter(([, text, background]) => contrastRatio(text, background) < 4.5).map(([name]) => name);
  const apply = () => {
    try { saveCustomPalette(palette); onApply(); }
    catch { setError("Your browser could not save this theme. Enable local storage and try again."); }
  };
  return createPortal(<div className="ct-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="ct-frame" style={{ width: 1100 * scale, height: 650 * scale }}>
    <div className="ct-dialog" style={{ transform: `scale(${scale})` }} role="dialog" aria-modal="true" aria-labelledby="ct-title" aria-describedby="ct-description" ref={dialog} tabIndex={-1}>
      <header className="ct-header"><div>
        <p className="ct-eyebrow">SETTINGS / APPEARANCE</p><h2 id="ct-title">Custom colours</h2>
        <p id="ct-description">Choose a palette, then customise every colour.</p>
      </div><button type="button" className="ct-close" onClick={onClose} aria-label="Close custom colours"><X size={20} /></button></header>
      <nav className="ct-tabs" aria-label="Colour settings sections">
        <button type="button" aria-pressed={view === "presets"} onClick={() => setView("presets")}><Palette size={14} /> Palettes <span>12</span></button>
        <button type="button" aria-pressed={view === "colours"} onClick={() => setView("colours")}><SlidersHorizontal size={14} /> Fine-tune colours <span>16</span></button>
        <span className="ct-current-palette">{selectedPreset?.name || "Custom palette"}</span>
      </nav>
      <div className="ct-content">
        <section className="ct-options" aria-label="Theme presets and colour settings">
          {view === "presets" ? <>
          <div className="ct-section-title"><h3>Start with a palette</h3><span>Select any preset to preview</span></div>
          <div className="ct-presets">{CUSTOM_PRESETS.map(preset => <button key={preset.name} type="button" className="ct-preset" aria-pressed={selectedPreset?.name === preset.name} onClick={() => setPalette({ ...preset.colours })}>
            <span className="ct-preset-swatch" style={{ background: preset.colours.background }}>{[preset.colours.surface2, preset.colours.primary, preset.colours.secondary].map((colour, i) => <i key={i} style={{ background: colour }} />)}{selectedPreset?.name === preset.name && <Check size={14} style={{ color: preset.colours.text }} />}</span>
            <strong>{preset.name}</strong><small>{preset.description}</small>
          </button>)}</div>
          </> : <div className="ct-tuning">
            <div><div className="ct-section-title"><h3>Colour roles</h3><span>Select to edit</span></div><div className="ct-fields">
            {COLOUR_FIELDS.map(f => <button type="button" key={f.key} className="ct-field" aria-pressed={activeKey === f.key} onClick={() => setActiveKey(f.key)}>
              <span className="ct-field-colour" style={{ background: palette[f.key] }} /><span><strong>{f.label}</strong><small>{palette[f.key].toUpperCase()}</small></span>{activeKey === f.key && <span className="ct-field-dot" />}
            </button>)}
            </div></div>
            <div className="ct-wheel-panel"><div className="ct-edit-title"><span style={{ background: palette[activeKey] }} /><h3>{field.label}</h3></div>
              <ColourWheel key={activeKey} label={field.label} value={palette[activeKey]} onChange={hex => setPalette(previous => ({ ...previous, [activeKey]: hex }))} />
            </div>
          </div>}
        </section>
        <aside className="ct-editor">
          <div className="ct-section-title"><h3>Live preview</h3><span>{selectedPreset?.name || "Your palette"}</span></div>
          <ThemePreview palette={palette} />
          {lowContrast.length > 0 ? <div className="ct-contrast" role="status" title={lowContrast.join(", ")}><b>{lowContrast.length} text contrast {lowContrast.length === 1 ? "issue" : "issues"}</b><p>Adjust text or background colours in Fine-tune.</p></div> : <div className="ct-contrast ct-contrast-good"><Check size={14} /> Text contrast looks good</div>}
          <p className="ct-hint">Changes stay in this preview until you apply. Button labels adjust automatically.</p>
        </aside>
      </div>
      <footer className="ct-footer"><button type="button" className="ct-button ct-reset" onClick={() => { setPalette({ ...CUSTOM_PRESETS[0].colours }); setError(""); }}><RotateCcw size={14} /> Reset</button>
        <span className="ct-save-note" role="status">{error || "Saved on this device · applies across careers"}</span>
        <button type="button" className="ct-button" onClick={onClose}>Cancel</button><button type="button" className="ct-button ct-apply" onClick={apply}><Check size={15} /> Apply theme</button>
      </footer>
    </div>
    </div>
  </div>, document.body);
}
