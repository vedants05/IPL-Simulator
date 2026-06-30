import NavBar from "@/components/shared/NavBar";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col" style={{ minWidth: 1280 }}>
      <NavBar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
