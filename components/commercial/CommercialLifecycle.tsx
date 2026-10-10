"use client";
import { getHomeStadium } from "@/lib/data/pitchCurator";
import { advanceBusiness, contractPayroll, effectiveCapacity, loadBusiness, saveBusiness } from "@/lib/logic/commercial/engine";
import { useGameStore } from "@/lib/store/gameStore";
import { useEffect } from "react";
export default function CommercialLifecycle() {
    useEffect(() => {
        let processing = false;
        const sync = () => {
            if (processing)
                return;
            processing = true;
            try {
                const g = useGameStore.getState();
                if (!g.saveId || !g.userTeamId || !g.teams[g.userTeamId] || !g.currentDate)
                    return;
                const capacity = effectiveCapacity(g.saveId, g.userTeamId, getHomeStadium(g.userTeamId)?.capacity ?? 45000);
                const squad = g.teams[g.userTeamId].squad.map(id => g.players[id]).filter(Boolean);
                const playerPayroll = contractPayroll(squad, g.userTeamId, g.currentSeason);
                const context = { date: g.currentDate, capacity, playerPayroll };
                Object.assign(context, { staffPayroll: Object.values(g.careerStaff.contracts).filter(c => c.teamId === g.userTeamId && c.status === "contracted").reduce((sum, c) => sum + Math.round(c.annualSalary), 0) });
                const original = loadBusiness(g.saveId, g.userTeamId, g.currentSeason, capacity, squad, g.currentDate);
                const state = advanceBusiness(original, context);
                if (JSON.stringify(state) !== JSON.stringify(original))
                    saveBusiness(g.saveId, state);
            }
            catch (error) {
                console.error("Commercial lifecycle update failed; existing data retained", error);
            }
            finally {
                processing = false;
            }
        };
        sync();
        const unsub = useGameStore.subscribe((state, previous) => {
            if (state.currentDate !== previous.currentDate || state.currentSeason !== previous.currentSeason || state.saveId !== previous.saveId)
                sync();
        });
        const persist = () => useGameStore.setState({});
        window.addEventListener("ipl-commercial-changed", persist);
        return () => { unsub(); window.removeEventListener("ipl-commercial-changed", persist); };
    }, []);
    return null;
}
