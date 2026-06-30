"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";

export default function RootPage() {
  const router = useRouter();
  const { saveId } = useGameStore();

  useEffect(() => {
    if (saveId) {
      router.replace("/game/auction");
    } else {
      router.replace("/setup");
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-[#8b91a8] text-sm">Loading...</div>
    </div>
  );
}
