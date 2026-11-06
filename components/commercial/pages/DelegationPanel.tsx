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
  const [desk, setDesk] = useState<Desk>("retail");
  const [draft, setDraft] = useState<Delegation>(p.s.experience.delegation.retail);
  const [advanced, setAdvanced] = useState(false);

  return <Panel title="Who handles commercial decisions?" className="commercial-delegation-panel">
    <p className="commercial-delegation-intro">Choose an area and how much you want to handle yourself.</p>
    <Field label="Commercial area"><select value={desk} onChange={e => {
      const next = e.target.value as Desk;
      setDesk(next);
      setDraft(p.s.experience.delegation[next]);
      setAdvanced(false);
    }}>{desks.map(item => <option value={item} key={item}>{names[item]}</option>)}</select></Field>
    <div className="commercial-delegation-choices" role="group" aria-label={`How to manage ${names[desk]}`}>
      {choices.map(choice => <button type="button" key={choice.value} aria-pressed={draft.mode === choice.value}
        onClick={() => setDraft({ ...draft, mode: choice.value })}>
        <strong>{choice.label}</strong><span>{choice.description}</span>
      </button>)}
    </div>
    {draft.mode === "auto" && <p className="commercial-delegation-summary"><strong>Delegated:</strong> {descriptions[desk]} {desk !== "finance" && "Your spending and review limits still apply."}</p>}
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
    <div className="commercial-delegation-footer"><button type="button" className="commercial-primary" onClick={() => p.send({ type: "delegate", desk, settings: draft })}>Save {names[desk]} choice</button></div>
  </Panel>;
}
