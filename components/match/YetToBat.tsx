export default function YetToBat({ names }: { names: readonly string[] }) {
  if (!names.length) return null;
  return (
    <div className="px-4 py-2 font-barlow text-xs text-text-secondary">
      <span className="mr-2 font-space-mono text-[9px] font-bold uppercase text-text-primary">Yet to bat</span>
      {names.join(", ")}
    </div>
  );
}
