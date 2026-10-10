"use client";
import { advanceBusiness, contractPayroll, executeCommand, loadBusiness, saveBusiness, subscribeBusiness, type BusinessContext, type BusinessState, type Command, type FixturePlan } from "@/lib/logic/commercial/engine";
import type { TeamSupporterView } from "@/lib/logic/supporters";
import { useGameStore } from "@/lib/store/gameStore";
import type { Player } from "@/lib/types";
import { Settings2, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import DelegationPanel from "./pages/DelegationPanel";
import Finance from "./pages/Finance";
import Matchday from "./pages/Matchday";
import Office from "./pages/Office";
import Operations from "./pages/Operations";
import Partnerships from "./pages/Partnerships";
import Retail from "./pages/Retail";
import { date, names, Panel, Modal, type PageProps } from "./shared/CommercialUI";
export interface CommercialMainPageProps {
    saveId: string;
    teamId: string;
    season: number;
    stadiumCapacity?: number;
    stadiumName?: string;
    squadPlayers?: Player[];
    supporterView?: TeamSupporterView;
    onNavigateToSupporters?: () => void;
    activeSubTab?: string;
    onSelectSubTab?: (tab: string) => void;
    fixtures?: FixturePlan[];
}
export default function CommercialMainPage(props: CommercialMainPageProps) {
    const currentDate = useGameStore(g => g.currentDate), capacity = props.stadiumCapacity ?? 45000;
    const staff = useGameStore(g => g.careerStaff);
    const context: BusinessContext = { date: currentDate, capacity, fixtures: props.fixtures, supporters: props.supporterView ? { overallHappiness: props.supporterView.overallHappiness, squadApproval: props.supporterView.categoryApproval.squad, homeAtmosphere: props.supporterView.homeAtmosphere, topPlayerApproval: props.supporterView.popularPlayers[0]?.approval } : undefined, playerPayroll: props.squadPlayers?.length ? contractPayroll(props.squadPlayers, props.teamId, props.season) : undefined, staffPayroll: staff.initialized ? Object.values(staff.contracts).filter(c => c.teamId === props.teamId && c.status === "contracted").reduce((sum, c) => sum + Math.round(c.annualSalary), 0) : undefined };
    const signature = JSON.stringify(context), key = `${props.saveId}:${props.teamId}:${props.season}`, contextRef = useRef(context);
    contextRef.current = context;
    const [s, setState] = useState<BusinessState | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [source, setSource] = useState<string | undefined>(), [delegating, setDelegating] = useState(false);
    const [information, setInformation] = useState(false);
    const aliases: Record<string, string> = { ticketing: "matchday", hospitality: "matchday", matchdayops: "matchday", sponsorships: "partnerships", merchandising: "retail", marketing: "retail", facilities: "operations", broadcast: "finance", operatingcosts: "finance" };
    const page = aliases[props.activeSubTab ?? ""] ?? props.activeSubTab ?? "overview";
    useEffect(() => {
        const reload = () => {
            try {
                setState(loadBusiness(props.saveId, props.teamId, props.season, capacity, props.squadPlayers, currentDate));
                setError("");
            }
            catch (e) {
                setError(e instanceof Error ? e.message : "Commercial data could not be loaded.");
            }
        };
        try {
            const original = loadBusiness(props.saveId, props.teamId, props.season, capacity, props.squadPlayers, currentDate);
            const next = advanceBusiness(original, contextRef.current);
            if (JSON.stringify(original) !== JSON.stringify(next) || !localStorage.getItem(`ipl_commercial_state_${props.saveId}_${props.teamId.toLowerCase()}_${props.season}`))
                saveBusiness(props.saveId, next, original.experience.revision);
            setState(next);
            setError("");
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Commercial data could not be saved.");
        }
        const unsub = subscribeBusiness(reload);
        window.addEventListener("storage", reload);
        return () => { unsub(); window.removeEventListener("storage", reload); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, signature]);
    const navigate = (target: string, id?: string) => { setSource(id); props.onSelectSubTab?.(target); };
    const send = (cmd: Command) => {
        if (!s)
            return false;
        try {
            const latest = loadBusiness(props.saveId, props.teamId, props.season, capacity, props.squadPlayers, currentDate);
            const result = executeCommand(latest, cmd, context, s.experience.revision);
            if (!result.ok) {
                setNotice(result.message);
                setState(latest);
                return false;
            }
            saveBusiness(props.saveId, result.state, latest.experience.revision);
            setState(result.state);
            setNotice(result.message);
            return true;
        }
        catch (e) {
            setNotice(e instanceof Error ? e.message : "The decision could not be saved; try again.");
            return false;
        }
    };
    if (!s)
        return <div className="commercial-experience"><Panel title={error ? "Commercial save needs attention" : "Loading commercial office"}><p role="alert">{error || "Preparing your business records…"}</p>{error && <p>Existing data has been retained. Reload the career to retry.</p>}</Panel></div>;
    const p: PageProps = { s, context, send, navigate, draftId: `${key}:${page}`, source };
    return <div className="commercial-experience"><header className="commercial-heading"><div><Wallet size={18}/><div><small>{props.stadiumName ?? "Home stadium"} · Season {props.season} · {date(s.experience.date)}</small><h2>{names[page] ?? "Commercial office"}</h2></div></div><div className="commercial-heading-actions">{s.experience.migration && <button onClick={() => setInformation(true)}>Save history</button>}<button aria-expanded={delegating} onClick={() => setDelegating(true)}><Settings2 size={12}/>Delegation</button></div></header>{notice && <div className="commercial-notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}{error && <p className="commercial-error" role="alert">{error}</p>}<div className="commercial-workspace" key={`${key}:${page}`}>{page === "overview" ? <Office {...p}/> : page === "matchday" ? <Matchday {...p}/> : page === "partnerships" ? <Partnerships {...p}/> : page === "retail" ? <Retail {...p}/> : page === "operations" ? <Operations {...p}/> : <Finance {...p}/>}</div>{delegating && <Modal title="Commercial preferences" onClose={() => setDelegating(false)}><DelegationPanel {...p}/></Modal>}{information && <Modal title="Previous commercial records" onClose={() => setInformation(false)}><p>{s.experience.migration}</p></Modal>}</div>;
}
