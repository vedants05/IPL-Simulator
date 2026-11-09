"use client";

import { cr, inr, type Delegation, type Desk } from "@/lib/logic/commercial/engine";
import { useState } from "react";
import { Field, names, Panel, type PageProps } from "../shared/CommercialUI";

const desks: Desk[] = ["matchday", "partnerships", "retail", "operations", "finance"];
const descriptions: Record<Desk, string> = {
  matchday: "Set prices for upcoming home matches.",
  partnerships: "Accept eligible partnership offers.",
  retail: "Reorder low-stock products.",
  operations: "Renew eligible service agreements.",
  finance: "Monitor finances; no borrowing or reserve changes.",
};
const choices: { value: Delegation["mode"]; label: string; description: string }[] = [
  { value: "manual", label: "I'll manage", description: "I make the decisions." },
  { value: "recommend", label: "Recommend", description: "Review suggestions and decide." },
  { value: "auto", label: "Delegate", description: "Handle eligible decisions within my limits." },
];

export default function DelegationPanel(p: PageProps) {
  const [desk, setDesk] = useState<Desk | "all">("all");
  const [draft, setDraft] = useState<Delegation>(p.s.experience.delegation.retail);
  const [selected, setSelected] = useState<Desk[]>(desks);
  const [advanced, setAdvanced] = useState(false);
  const [feedback, setFeedback] = useState<{ signature: string; saved: boolean } | null>(null);
  const signature = JSON.stringify({ desk, selected: desk === "all" ? selected : [], draft });

  return <Panel title="Who handles commercial decisions?" className="commercial-delegation-panel">
    <p className="commercial-delegation-intro">Choose how to manage all commercial areas, or select specific areas.</p>
    <Field label="Commercial area"><select value={desk} onChange={e => {
      const next = e.target.value as Desk | "all";
      setDesk(next);
      setDraft(p.s.experience.delegation[next === "all" ? "retail" : next]);
      setAdvanced(false);
    }}><option value="all">All commercial areas</option>{desks.map(item => <option value={item} key={item}>{names[item]}</option>)}</select></Field>
    {desk === "all" && <div className="commercial-actions" role="group" aria-label="Commercial areas to update">{desks.map(item => <label key={item}><input type="checkbox" checked={selected.includes(item)} onChange={e => setSelected(e.target.checked ? [...selected, item] : selected.filter(value => value !== item))}/>{names[item]}</label>)}</div>}
    <div className="commercial-delegation-choices" role="group" aria-label={`How to manage ${desk === "all" ? "commercial areas" : names[desk]}`}>
      {choices.map(choice => <button type="button" key={choice.value} aria-pressed={draft.mode === choice.value}
        onClick={() => setDraft({ ...draft, mode: choice.value })}>
        <strong>{choice.label}</strong><span>{choice.description}</span>
      </button>)}
    </div>
    {draft.mode === "auto" && <p className="commercial-delegation-summary"><strong>Delegated:</strong> {desk === "all" ? "Eligible decisions in the selected areas." : descriptions[desk]} {desk !== "finance" && "Your spending and review limits still apply."}</p>}
    {desk !== "all" && <>
    <button type="button" className="commercial-delegation-advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
      {advanced ? "Hide limits and exceptions" : "Limits and exceptions"} {advanced ? "−" : "+"}
    </button>
    {advanced && <div className="commercial-delegation-advanced">
      <div className="commercial-form-grid">
        <Field label="Spend cap per action (Cr)"><input type="number" min="0" step="0.1" value={cr(draft.cap)} onChange={e => setDraft({ ...draft, cap: inr(Number(e.target.value)) })}/></Field>
        <Field label="Minimum cash reserve (Cr)"><input type="number" min="0" value={cr(draft.reserve)} onChange={e => setDraft({ ...draft, reserve: inr(Number(e.target.value)) })}/></Field>
        <Field label="Maximum contract term (years)"><input type="number" min="1" max="5" value={draft.maxTerm} onChange={e => setDraft({ ...draft, maxTerm: Number(e.target.value) })}/></Field>
      </div>
      <div className="commercial-actions">{(["access", "balanced", "premium"] as const).map(policy => <label key={policy}><input type="checkbox" checked={draft.allowedPolicies.includes(policy)} onChange={e => setDraft({ ...draft, allowedPolicies: e.target.checked ? [...draft.allowedPolicies, policy] : draft.allowedPolicies.filter(v => v !== policy) })}/>{policy} pricing allowed</label>)}</div>
      <div className="commercial-actions">{Array.from(new Set(p.s.sponsorships.deals.map(d => d.category))).map(category => <label key={category}><input type="checkbox" checked={draft.manualCategories.includes(category)} onChange={e => setDraft({ ...draft, manualCategories: e.target.checked ? [...draft.manualCategories, category] : draft.manualCategories.filter(c => c !== category) })}/>{category.replaceAll("_", " ")} requires my review</label>)}</div>
    </div>}
    </>}
    <div className="commercial-delegation-footer">
      {feedback?.signature === signature && <span role={feedback.saved ? "status" : "alert"} className={feedback.saved ? "commercial-delegation-saved" : "commercial-error"}>{feedback.saved ? "Preferences saved" : "Could not save preferences. Please try again."}</span>}
      <button type="button" className="commercial-primary" disabled={desk === "all" && !selected.length} onClick={() => {
        const saved = desk === "all" ? p.sendMany?.(selected.map(item => ({ type: "delegate", desk: item, settings: { ...p.s.experience.delegation[item], mode: draft.mode } }))) : p.send({ type: "delegate", desk, settings: draft });
        setFeedback({ signature, saved: Boolean(saved) });
      }}>Save {desk === "all" ? "commercial" : names[desk]} choice</button>
    </div>
  </Panel>;
}
