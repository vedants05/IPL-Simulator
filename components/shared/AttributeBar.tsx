"use client";

interface Props {
  label: string;
  value: number; // 1–20
}

export default function AttributeBar({ label, value }: Props) {
  const pct = (value / 20) * 100;
  const color =
    value >= 17 ? "bg-success" :
    value >= 13 ? "bg-accent" :
    value >= 9  ? "bg-gold" :
    "bg-danger";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-text-secondary truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 text-right text-text-primary font-mono font-semibold">{value}</span>
    </div>
  );
}
