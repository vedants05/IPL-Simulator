import NavBar from "@/components/shared/NavBar";
import TeamThemeProvider from "@/components/shared/TeamThemeProvider";
import SupabasePlayerSync from "@/components/shared/SupabasePlayerSync";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeamThemeProvider>
      <SupabasePlayerSync />
      <div className="min-h-screen bg-bg text-text-primary flex flex-col" style={{ minWidth: 1280 }}>
        <NavBar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </TeamThemeProvider>
  );
}
