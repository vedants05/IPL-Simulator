"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SquadPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/game/overview?tab=squad");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen bg-bg">
      <div className="font-space-mono text-xs text-text-secondary uppercase tracking-widest animate-pulse">
        Redirecting to Squad Hub...
      </div>
    </div>
  );
}
