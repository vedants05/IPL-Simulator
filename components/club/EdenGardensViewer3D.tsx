"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { STAND_DESIGNS, edenExistingBoxes } from "./stadiumVisualDesigns";

type ViewerModule = {
  id: number;
  standName: string;
  templateId: string;
  roof: string;
  capacity: number;
  condition: number;
  quality?: string;
  constructionYear?: number;
  empty?: boolean;
};

type Props = {
  modules: ViewerModule[];
  selected: number[];
  activeModuleIds?: number[];
  project?: { phase: string; action: string; templateId: string; roof: string; quality: string } | null;
  onToggleModule: (id: number) => void;
};

const tierCount = (templateId: string) => (STAND_DESIGNS[templateId] ?? STAND_DESIGNS['standard-two']).tiers;

function Ground() {
  return <group><mesh rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[44, 96]}/><meshStandardMaterial color="#397943" roughness={1}/></mesh><mesh position={[0, .025, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[3.2, 21]}/><meshStandardMaterial color="#c8b47b" roughness={1}/></mesh><mesh position={[0, .04, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[35.5, 35.7, 96]}/><meshBasicMaterial color="#f5f0dc"/></mesh></group>;
}

// Shared dimensions keep seating, concrete terraces and roof supports aligned.
const ROWS = 12;
const RUN = .8;
const RISE = .43;
const tierRadius = (tier: number) => 47 + tier * 10.4;
const tierHeight = (tier: number) => 1 + tier * 7.2;

function ArcBlock({ inner, outer, bottom, top, start, sweep, color }: {
  inner: number; outer: number; bottom: number; top: number; start: number; sweep: number; color: string;
}) {
  const geometry = useMemo(() => {
    const points = [new THREE.Vector2(inner, bottom), new THREE.Vector2(outer, bottom),
      new THREE.Vector2(outer, top), new THREE.Vector2(inner, top), new THREE.Vector2(inner, bottom)];
    return new THREE.LatheGeometry(points, 18, start, sweep);
  }, [inner, outer, bottom, top, start, sweep]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial color={color} roughness={.85} side={THREE.DoubleSide}/></mesh>;
}

function Seats({ moduleIndex, count, tiers, selected, spacing, faded }: { moduleIndex: number; count: number; tiers: number; selected: boolean; spacing: number; faded: boolean }) {
  const bases = useRef<THREE.InstancedMesh>(null);
  const backs = useRef<THREE.InstancedMesh>(null);
  const seats = useMemo(() => {
    const result: { base: THREE.Matrix4; back: THREE.Matrix4 }[] = [];
    const centre = moduleIndex / count * Math.PI * 2;
    const width = Math.PI * 2 / count;
    for (let tier = 0; tier < tiers; tier++) for (let row = 0; row < ROWS; row++) {
      const radius = tierRadius(tier) + (row + .5) * RUN;
      const total = Math.floor(radius * width / spacing);
      for (let seat = 0; seat < total; seat++) {
        // Leave a central stair aisle and access space at the section boundaries.
        const fraction = (seat + .5) / total;
        if (Math.abs(fraction - .5) < .055 || fraction < .045 || fraction > .955) continue;
        const angle = centre + (fraction - .5) * width;
        const object = new THREE.Object3D();
        object.position.set(Math.sin(angle) * radius, tierHeight(tier) + row * RISE + .27, Math.cos(angle) * radius);
        object.rotation.y = angle;
        object.updateMatrix();
        const base = object.matrix.clone();
        object.position.add(new THREE.Vector3(Math.sin(angle) * .17, .27, Math.cos(angle) * .17));
        object.updateMatrix();
        result.push({ base, back: object.matrix.clone() });
      }
    }
    return result;
  }, [count, moduleIndex, tiers, spacing]);
  useEffect(() => {
    if (!bases.current || !backs.current) return;
    seats.forEach((seat, index) => { bases.current!.setMatrixAt(index, seat.base); backs.current!.setMatrixAt(index, seat.back); });
    for (const mesh of [bases.current, backs.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [seats]);
  const color = selected ? "#eac550" : faded ? '#91938a' : ["#548eac", "#e2bd69", "#7694b3", "#ba795d"][moduleIndex % 4];
  return <group>
    <instancedMesh ref={bases} args={[undefined, undefined, seats.length]}><boxGeometry args={[.42, .12, .4]}/><meshStandardMaterial color={color} roughness={.7}/></instancedMesh>
    <instancedMesh ref={backs} args={[undefined, undefined, seats.length]}><boxGeometry args={[.42, .48, .1]}/><meshStandardMaterial color={color} roughness={.7}/></instancedMesh>
  </group>;
}

function Stand({ entry, index, count, selected, active, onSelect, linkedBefore, linkedAfter }: {
  entry: ViewerModule; index: number; count: number; selected: boolean; active: boolean;
  onSelect: () => void; linkedBefore: boolean; linkedAfter: boolean;
}) {
  const tiers = tierCount(entry.templateId);
  const angle = index / count * Math.PI * 2;
  const step = Math.PI * 2 / count;
  const start = angle - step / 2 + (linkedBefore ? 0 : .012);
  const sweep = step - (linkedBefore ? 0 : .012) - (linkedAfter ? 0 : .012);
  if (entry.empty) return null;
  const design = STAND_DESIGNS[entry.templateId] ?? STAND_DESIGNS['standard-two'];
  const concrete = active ? "#b69a73" : entry.condition < 60 ? '#8d887a' : entry.quality === 'Elite' ? '#e8e4d9' : "#c3c0b7";
  const roofY = tierHeight(tiers - 1) + ROWS * RISE + 3;
  const rear = tierRadius(tiers - 1) + ROWS * RUN;
  const pavilion = /pavilion|heritage|hospitality|corporate|media/.test(entry.templateId);
  return <group onClick={(event) => { event.stopPropagation(); if (event.delta < 5) onSelect(); }}>
    {Array.from({ length: tiers }, (_, tier) => <group key={tier}>
      {Array.from({ length: ROWS }, (_, row) => <ArcBlock key={row}
        inner={tierRadius(tier) + row * RUN} outer={tierRadius(tier) + (row + 1) * RUN}
        bottom={tier === 0 ? 0 : tierHeight(tier) - .75 + row * RISE}
        top={tierHeight(tier) + row * RISE} start={start} sweep={sweep} color={concrete}/>)}
      <ArcBlock inner={tierRadius(tier) - .15} outer={tierRadius(tier) + .12}
        bottom={tierHeight(tier)} top={tierHeight(tier) + .85} start={start} sweep={sweep}
        color={selected ? "#e8c34d" : "#eeece4"}/>
      <ArcBlock inner={tierRadius(tier) + ROWS * RUN} outer={tierRadius(tier) + ROWS * RUN + .7}
        bottom={0} top={tierHeight(tier) + ROWS * RISE} start={start} sweep={sweep} color="#adafa8"/>
    </group>)}
    {!active && <Seats moduleIndex={index} count={count} tiers={tiers} selected={selected} spacing={design.spacing * (entry.quality === 'Elite' ? 1.08 : 1)} faded={entry.condition < 60}/>}
    <StandDetails entry={entry} angle={angle} step={step} roofY={roofY} rear={rear} active={active}/>
    {(entry.roof === 'None' ? [] : [-.42, 0, .42]).map((fraction) => {
      const a = angle + step * fraction;
      return <group key={fraction}>
        <mesh position={[Math.sin(a) * rear, roofY / 2, Math.cos(a) * rear]} rotation-y={a}>
          <boxGeometry args={[.42, roofY, .6]}/><meshStandardMaterial color="#e4e4da"/>
        </mesh>
        {entry.roof !== "None" && <mesh position={[Math.sin(a) * (rear - 4), roofY - .25, Math.cos(a) * (rear - 4)]} rotation-y={a}>
          <boxGeometry args={[.22, .48, 10]}/><meshStandardMaterial color="#8e989c" metalness={.5} roughness={.5}/>
        </mesh>}
      </group>;
    })}
    {entry.roof !== "None" && !active && <ArcBlock inner={rear - (entry.roof === "Partial canopy" ? 4 : entry.roof === 'Cantilever' ? 13 : 10)}
      outer={rear + 1.2} bottom={roofY} top={roofY + .22} start={start} sweep={sweep} color="#e1e4df"/>}
    {pavilion && <ArcBlock inner={46.2} outer={46.5} bottom={.1} top={.85} start={start} sweep={sweep} color="#344f60"/>}
    <ArcBlock inner={45.4} outer={45.55} bottom={.05} top={.65} start={start} sweep={sweep} color="#51276b"/>
  </group>;
}

function StandDetails({ entry, angle, step, roofY, rear, active }: {
  entry: ViewerModule; angle: number; step: number; roofY: number; rear: number; active: boolean;
}) {
  const design = STAND_DESIGNS[entry.templateId] ?? STAND_DESIGNS['standard-two'];
  const boxes = edenExistingBoxes(entry) ?? design.boxes;
  const levels = entry.templateId === 'corporate' || entry.templateId === 'hospitality-three' || entry.templateId === 'landmark' ? 2 : 1;
  return <group>
    {!active && Array.from({ length: levels }, (_, level) => Array.from({ length: boxes }, (_, box) => {
      const a = angle + step * ((box + .5) / boxes - .5) * .9;
      const radius = tierRadius(Math.min(level + 1, design.tiers - 1)) - .7;
      const y = tierHeight(Math.min(level + 1, design.tiers - 1)) - 1;
      const width = radius * step * .86 / boxes;
      const heritage = design.style === 'heritage';
      return <group key={`${level}-${box}`} position={[Math.sin(a) * radius, y, Math.cos(a) * radius]} rotation-y={a}>
        <mesh><boxGeometry args={[width, 1.65, 1.1]}/><meshStandardMaterial color={heritage ? '#b89973' : '#e3e1d8'}/></mesh>
        <mesh position={[0, .05, -.565]}><boxGeometry args={[width * .85, 1.15, .035]}/><meshStandardMaterial color={heritage ? '#6c756c' : '#365e70'} metalness={.55} roughness={.17}/></mesh>
        <mesh position={[0, -.72, -.7]}><boxGeometry args={[width, .18, .5]}/><meshStandardMaterial color={design.style === 'premium' ? '#c6a963' : '#f0eee5'}/></mesh>
        {design.style === 'media' && <mesh position={[0, .15, -.85]}><boxGeometry args={[.22, .24, .45]}/><meshStandardMaterial color="#252a2c"/></mesh>}
        {heritage && [-.45, .45].map((side) => <mesh key={side} position={[width * side, .12, -.66]}><cylinderGeometry args={[.08, .1, 1.6, 8]}/><meshStandardMaterial color="#eee3c8"/></mesh>)}
      </group>;
    }))}
    {Array.from({ length: active ? 9 : 5 }, (_, i) => {
      const a = angle + step * (i / (active ? 8 : 4) - .5) * .92;
      return <group key={i} rotation-y={a}>
        {active ? <group>
          <mesh position={[0, roofY / 2, rear - 5]}><cylinderGeometry args={[.055, .055, roofY, 6]}/><meshStandardMaterial color="#a5afb4"/></mesh>
          {[3, 6, 9, 12].filter(y => y < roofY).map(y => <mesh key={y} position={[0, y, rear - 5]}><boxGeometry args={[rear * step / 8, .08, .12]}/><meshStandardMaterial color="#c4b582"/></mesh>)}
        </group> : entry.roof === 'Cantilever' ? <mesh position={[0, roofY - 1, rear - 4.5]} rotation-x={-.12}><boxGeometry args={[.18, .7, 14]}/><meshStandardMaterial color="#929ca3" metalness={.5}/></mesh>
          : entry.roof === 'Landmark roof' ? <mesh position={[0, roofY + .75 + Math.sin(i / 4 * Math.PI), rear - 4]} rotation-x={-.12}><boxGeometry args={[rear * step / 5 + .2, .18, 12]}/><meshStandardMaterial color="#f1eee0" side={THREE.DoubleSide}/></mesh> : null}
      </group>;
    })}
    {design.style === 'club' && <ArcBlock inner={46} outer={46.7} bottom={0} top={.9} start={angle-step/2} sweep={step} color="#efe6cf"/>}
    {design.style === 'landmark' && <ArcBlock inner={rear-.4} outer={rear} bottom={roofY-.8} top={roofY-.45} start={angle-step/2} sweep={step} color="#ab8250"/>}
  </group>;
}

function Floodlight({ angle }: { angle: number }) {
  return <group position={[Math.sin(angle) * 72, 0, Math.cos(angle) * 72]}><mesh position={[0, 14, 0]}><cylinderGeometry args={[.35, .65, 28, 8]}/><meshStandardMaterial color="#9aa1a5" metalness={.7}/></mesh><mesh position={[0, 28, 0]} rotation={[0, -angle, 0]}><boxGeometry args={[7, 3.2, .8]}/><meshStandardMaterial color="#e8e5d8" emissive="#fff2c2" emissiveIntensity={.45}/></mesh></group>;
}

function Scene({ modules: savedModules, selected, activeModuleIds, project, onToggleModule, targetYaw }: Props & { targetYaw: number }) {
  const modules = savedModules.map(entry => {
    if (!activeModuleIds?.includes(entry.id) || !project) return entry;
    if (project.phase === 'cleared') return { ...entry, empty: true };
    if (project.phase === 'construction') return { ...entry, empty: false, templateId: project.action === 'refurbish' ? entry.templateId : project.templateId, roof: project.roof, quality: project.quality };
    return entry;
  });
  const stadium = useRef<THREE.Group>(null);
  useFrame(({ camera }, delta) => { camera.rotation.order = "YXZ"; camera.rotation.y = THREE.MathUtils.damp(camera.rotation.y, targetYaw, 7, delta); camera.rotation.x = .045; });
  return <><ambientLight intensity={1.4}/><directionalLight position={[25, 45, 15]} intensity={2.4} castShadow/><hemisphereLight args={["#b8dcff", "#273823", 1.3]}/><Ground/><group ref={stadium}>{modules.map((entry, index) => <Stand linkedBefore={!modules[(index + modules.length - 1) % modules.length].empty && modules[(index + modules.length - 1) % modules.length].standName === entry.standName} linkedAfter={!modules[(index + 1) % modules.length].empty && modules[(index + 1) % modules.length].standName === entry.standName} key={entry.id} entry={entry} index={index} count={modules.length} selected={selected.includes(entry.id)} active={activeModuleIds?.includes(entry.id) ?? false} onSelect={() => onToggleModule(entry.id)}/>)}{[.35, 1.95, 3.5, 5.05].map((angle) => <Floodlight key={angle} angle={angle}/>)}</group></>;
}

export default function EdenGardensViewer3D(props: Props) {
  const [targetYaw, setTargetYaw] = useState(0);
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  const move = (x: number) => { if (drag.current) setTargetYaw(drag.current.yaw + (x - drag.current.x) * .008); };
  return <div className="relative h-full min-h-[420px] w-full touch-none overflow-hidden bg-[#8aa8b8]" onPointerDown={(event) => { drag.current = { x: event.clientX, yaw: targetYaw }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => move(event.clientX)} onPointerUp={() => { drag.current = null; }}>
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.8, 0], fov: 70, near: .1, far: 300 }} gl={{ antialias: true }}><color attach="background" args={["#adcddd"]}/><Scene {...props} targetYaw={targetYaw}/></Canvas>
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center"><span className="rounded-full bg-black/60 px-3 py-1.5 font-space-mono text-[7px] font-bold uppercase tracking-wider text-white/80">Drag left or right for a 360° view</span></div>
    <button type="button" aria-label="Turn left" onClick={() => setTargetYaw((yaw) => yaw - Math.PI / 6)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/45 px-3 py-2 text-lg text-white">‹</button><button type="button" aria-label="Turn right" onClick={() => setTargetYaw((yaw) => yaw + Math.PI / 6)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/45 px-3 py-2 text-lg text-white">›</button>
  </div>;
}
