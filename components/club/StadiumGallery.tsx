"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import StadiumViewer3D from './StadiumViewer3D';
import { getStadiumDefinition, STADIUMS, type TeamId } from './stadiums/definitions';
import { STAND_DESIGNS } from './stadiumVisualDesigns';
import type { ViewerModule, ViewerProject } from './stadiums/types';

type Project = ViewerProject & { moduleIds?: number[] };
interface Props {
  teamId:string;
  saveId:string;
  currentDate:string;
  modules:ViewerModule[];
  project:Project|null;
  createModules:(teamId:string)=>ViewerModule[];
  onClose:()=>void;
}

export default function StadiumGallery(props:Props) {
  const home=getStadiumDefinition(props.teamId).teamId;
  const [team,setTeam]=useState<TeamId>(home);
  const [selected,setSelected]=useState<number[]>([]);
  const dialog=useRef<HTMLDivElement>(null);
  const closeButton=useRef<HTMLButtonElement>(null);
  const close=useRef(props.onClose);close.current=props.onClose;
  const venues=useMemo(()=>Object.values(STADIUMS),[]);
  const layouts=useMemo(()=>Object.fromEntries(venues.map(venue=>{
    if(venue.teamId===home) return [venue.teamId,{modules:props.modules,project:props.project,saved:true}];
    const fallback={modules:props.createModules(venue.teamId),project:null as Project|null,saved:false};
    try {
      const key=`ipl-stadium-builder:${props.saveId||'career'}:${venue.teamId}:v2`;
      const legacyKey=`ipl-stadium-builder:${props.saveId||'career'}:PBK:v2`;
      const saved=JSON.parse(localStorage.getItem(key)??(venue.teamId==='PBKS'?localStorage.getItem(legacyKey):null)??'null');
      if(Array.isArray(saved?.modules)&&saved.modules.length===fallback.modules.length&&saved.modules.every((m:ViewerModule)=>
        m&&Number.isInteger(m.id)&&typeof m.standName==='string'&&Boolean(STAND_DESIGNS[m.templateId])&&Number.isFinite(m.capacity)&&Number.isFinite(m.condition)&&typeof m.roof==='string'
      )) return [venue.teamId,{modules:saved.modules as ViewerModule[],project:saved.activeProject as Project|null,saved:true}];
    } catch { /* Unavailable or malformed saved layouts use the original venue. */ }
    return [venue.teamId,fallback];
  })),[venues,home,props.modules,props.project,props.saveId,props.createModules]);
  const layout=layouts[team],venue=STADIUMS[team];
  const capacity=(id:TeamId)=>layouts[id].modules.reduce((sum:number,m:ViewerModule)=>sum+(m.empty?0:m.capacity),0).toLocaleString('en-GB');
  const choose=(id:TeamId)=>{setSelected([]);setTeam(id);};

  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';closeButton.current?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape') {event.preventDefault();event.stopPropagation();close.current();}
      if(event.key!=='Tab') return;
      const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),select,a[href],[tabindex="0"]')??[]).filter(el=>el.getClientRects().length>0);
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',key,true);
    return ()=>{document.removeEventListener('keydown',key,true);document.body.style.overflow=overflow;previous?.focus();};
  },[]);

  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-2 sm:p-4" onMouseDown={event=>{if(event.target===event.currentTarget)props.onClose();}}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="stadium-gallery-title" className="flex h-[94dvh] w-full max-w-[1600px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-bg text-text-primary shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div><h2 id="stadium-gallery-title" className="font-anton text-xl uppercase">Stadium gallery</h2><p className="text-xs text-text-secondary">Explore all ten grounds. Select stands to inspect them.</p></div>
        <button ref={closeButton} type="button" onClick={props.onClose} className="rounded border border-border px-3 py-2 text-xs font-bold">Close gallery</button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Choose a stadium" className="hidden w-64 shrink-0 overflow-y-auto border-r border-border p-3 md:block">
          {venues.map(item=><button key={item.teamId} type="button" aria-pressed={team===item.teamId} onClick={()=>choose(item.teamId)} className={`mb-2 w-full rounded-lg border p-3 text-left transition-colors ${team===item.teamId?'border-accent bg-accent/10':'border-border bg-surface hover:border-accent'}`}>
            <span className="flex items-center justify-between gap-2"><span className="font-bold" style={{color:item.fascia}}>{item.teamId}</span>{item.teamId===home&&<span className="text-[10px] text-text-secondary">Your ground</span>}</span>
            <span className="mt-1 block text-xs font-semibold leading-relaxed">{item.name}</span>
            <span className="mt-1 block text-[11px] text-text-secondary">{capacity(item.teamId)} seats</span>
          </button>)}
        </nav>
        <div className="shrink-0 border-b border-border p-3 md:hidden">
          <label htmlFor="gallery-venue" className="sr-only">Choose a stadium</label>
          <select id="gallery-venue" value={team} onChange={event=>choose(event.target.value as TeamId)} className="w-full rounded border border-border bg-surface p-2 text-sm">{venues.map(item=><option key={item.teamId} value={item.teamId}>{item.teamId} · {item.name}</option>)}</select>
        </div>
        <section aria-label="Selected stadium" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div><h3 className="font-anton text-lg">{venue.name}</h3><p className="text-xs text-text-secondary">{capacity(team)} seats · {layout.saved?'Career layout':'Original layout'}</p></div>
            <span className="text-xs text-text-secondary">Viewing only</span>
          </div>
          <div className="min-h-[420px] flex-1 overflow-hidden">
            <StadiumViewer3D key={team} teamId={team} currentDate={props.currentDate} modules={layout.modules} project={layout.project} activeModuleIds={layout.project?.moduleIds} selected={selected} onToggleModule={id=>setSelected(previous=>previous.includes(id)?[]:[id])}/>
          </div>
        </section>
      </div>
    </div>
  </div>,document.body);
}
