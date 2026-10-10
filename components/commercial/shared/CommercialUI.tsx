"use client";
import { cr, type BusinessContext, type BusinessState, type Command } from "@/lib/logic/commercial/engine";
import { formatDisplayDate } from "@/lib/logic/displayDate";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
export const money = (n: number) => `₹${cr(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export const date = (d: string) => formatDisplayDate(d).replace(/-/g, "/");
export const names: Record<string, string> = { overview: "Commercial office", matchday: "Matchday revenue", partnerships: "Partnerships", retail: "Retail & marketing", operations: "Club operations", finance: "Finance & rights" };
export const drafts = new Map<string, unknown>();
export { default as Modal } from "./CommercialModal";
export function useDraft<T>(id: string, initial: T) { const [value, setValue] = useState<T>(() => (drafts.get(id) as T) ?? initial); useEffect(() => { drafts.set(id, value); }, [id, value]); return [value, setValue] as const; }
export type PageProps = {
    s: BusinessState;
    context: BusinessContext;
    send: (cmd: Command) => boolean;
    navigate: (page: string, source?: string) => void;
    draftId: string;
    source?: string;
};
export function Panel({ title, children, action, className = "" }: {
    title: string;
    children: ReactNode;
    action?: ReactNode;
    className?: string;
}) { return <section className={`commercial-panel ${className}`}><header><h3>{title}</h3>{action}</header><div className="commercial-panel-body">{children}</div></section>; }
export function Metric({ label, value, note, onClick }: {
    label: string;
    value: string;
    note: string;
    onClick?: () => void;
}) { const content = <><span>{label}</span><strong>{value}</strong><small>{note}</small></>; return onClick ? <button className="commercial-metric" onClick={onClick}>{content}</button> : <div className="commercial-metric">{content}</div>; }
export function Tabs({ items, value, onChange }: {
    items: string[];
    value: string;
    onChange: (v: string) => void;
}) { return <div className="commercial-local-tabs" role="group" aria-label="Page views">{items.map(i => <button key={i} aria-pressed={value === i} onClick={() => onChange(i)}>{i.replaceAll("_", " ")}</button>)}</div>; }
export function Field({ label, children }: {
    label: string;
    children: ReactNode;
}) { return <label className="commercial-field"><span>{label}</span>{children}</label>; }
export function Preview({ children, cost = 0, commitment = 0, when, onApply, disabled, label = "Apply decision", onReset }: {
    children?: ReactNode;
    cost?: number;
    commitment?: number;
    when: string;
    onApply: () => void;
    disabled?: string;
    label?: string;
    onReset?: () => void;
}) { return <div className="commercial-preview"><h4>Decision preview <span>Draft · apply to save</span></h4>{children}<dl><div><dt>Cash now</dt><dd>{money(cost)}</dd></div><div><dt>Commitment</dt><dd>{money(commitment)}</dd></div><div><dt>Effective</dt><dd>{when}</dd></div></dl><div className="commercial-actions">{onReset && <button onClick={onReset}>Reset draft</button>}<button className="commercial-primary" disabled={Boolean(disabled)} onClick={onApply}>{label}<ArrowRight size={12}/></button></div>{disabled && <p className="commercial-error">{disabled}</p>}</div>; }
export function Comparison({ rows }: {
    rows: [
        string,
        number,
        number
    ][];
}) { return <div className="commercial-comparison"><table><thead><tr><th>Measure</th><th>Current / forecast</th><th>Proposed / actual</th><th>Change</th></tr></thead><tbody>{rows.map(([label, a, b]) => { const units = /Crowd|units|seats/.test(label); const format = (n: number) => units ? n.toLocaleString() : money(n); return <tr key={label}><td>{label}</td><td>{format(a)}</td><td>{format(b)}</td><td>{b - a >= 0 ? "+" : ""}{format(b - a)}</td></tr>; })}</tbody></table></div>; }
export function DeskLayout({ metrics, tabs, children, className = "" }: {
    metrics: ReactNode;
    tabs?: ReactNode;
    children: ReactNode;
    className?: string;
}) { return <div className={`commercial-desk ${className}`}><div className="commercial-metrics">{metrics}</div>{tabs}<div className="commercial-desk-content">{children}</div></div>; }
export function Empty({ children }: {
    children: ReactNode;
}) { return <div className="commercial-empty">{children}</div>; }
export function SummaryRows({ rows }: {
    rows: [
        string,
        ReactNode
    ][];
}) { return <dl className="commercial-summary">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>; }
export function usePagination(total: number, rowHeight = 42, resetKey = "") {
    const ref = useRef<HTMLDivElement>(null), [size, setSize] = useState(5), [page, setPage] = useState(0);
    useLayoutEffect(() => {
        const node = ref.current;
        if (!node)
            return;
        const measure = () => setSize(Math.max(1, Math.floor((node.clientHeight - 62) / rowHeight)));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [rowHeight]);
    useEffect(() => setPage(0), [resetKey]);
    const pages = Math.max(1, Math.ceil(total / size)), current = Math.min(page, pages - 1), start = current * size;
    return { ref, size, page: current, start, pages, setPage, total };
}
export function Pager({ pagination }: {
    pagination: ReturnType<typeof usePagination>;
}) { const p = pagination; return <footer className="commercial-pager"><span>{p.total ? `${p.start + 1}–${Math.min(p.total, p.start + p.size)} of ${p.total}` : "0 records"}</span><div><button aria-label="Previous records" disabled={!p.page} onClick={() => p.setPage(p.page - 1)}><ChevronLeft /></button><span>{p.page + 1} / {p.pages}</span><button aria-label="Next records" disabled={p.page >= p.pages - 1} onClick={() => p.setPage(p.page + 1)}><ChevronRight /></button></div></footer>; }
export function DataTable<T>({ rows, columns, empty = "No records to show.", rowHeight = 42, resetKey = "", getKey, onInspect }: {
    rows: T[];
    columns: {
        label: string;
        render: (row: T) => ReactNode;
        width?: string;
    }[];
    empty?: string;
    rowHeight?: number;
    resetKey?: string;
    getKey?: (row: T) => string;
    onInspect?: (row: T) => void;
}) {
    const pagination = usePagination(rows.length, rowHeight, resetKey);
    return <div className="commercial-data" ref={pagination.ref}><div className="commercial-table-wrap"><table><colgroup>{columns.map(c => <col key={c.label} style={{ width: c.width }}/>)}{onInspect && <col style={{ width: "65px" }}/>}</colgroup><thead><tr>{columns.map(c => <th key={c.label}>{c.label}</th>)}{onInspect && <th>Details</th>}</tr></thead><tbody>{rows.slice(pagination.start, pagination.start + pagination.size).map((row, i) => <tr key={getKey?.(row) ?? pagination.start + i} style={{ height: rowHeight }}>{columns.map(c => <td key={c.label}><div className="commercial-cell">{c.render(row)}</div></td>)}{onInspect && <td><button onClick={() => onInspect(row)}>Inspect</button></td>}</tr>)}</tbody></table>{!rows.length && <Empty>{empty}</Empty>}</div><Pager pagination={pagination}/></div>;
}
export function PagedList<T>({ rows, render, empty = "No records to show.", rowHeight = 64, resetKey = "" }: {
    rows: T[];
    render: (row: T) => ReactNode;
    empty?: string;
    rowHeight?: number;
    resetKey?: string;
}) { const pagination = usePagination(rows.length, rowHeight, resetKey); return <div className="commercial-data" ref={pagination.ref}><div className="commercial-list commercial-fitted-list">{rows.slice(pagination.start, pagination.start + pagination.size).map((row, i) => <div className="commercial-list-slot" key={pagination.start + i} style={{ height: rowHeight - 5 }}>{render(row)}</div>)}{!rows.length && <Empty>{empty}</Empty>}</div><Pager pagination={pagination}/></div>; }
