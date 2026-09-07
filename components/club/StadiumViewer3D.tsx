"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { buildStadium } from './stadiums/buildStadium';
import { getStadiumDefinition } from './stadiums/definitions';
import type { DetailLevel, StadiumViewerProps } from './stadiums/types';

type CameraMode = 'overview' | 'ground';
interface ViewOptions { yaw: number; zoom: number; mode: CameraMode; night: boolean; cutaway: boolean; detail: DetailLevel }
const buttonStyle = { border: '1px solid #ffffff50', background: '#10232be8', color: '#f4f0dc', borderRadius: 6, padding: '6px 9px', fontSize: 12, cursor: 'pointer' } as const;
const FIXED_NIGHT = true;
const FIXED_DETAIL: DetailLevel = 'medium';

class ViewerErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert" style={{ padding: 28, color: 'white' }}>The 3D viewer could not start. Return to Plan view, or try a browser with WebGL enabled.</div> : this.props.children;
  }
}

function Model({ teamId, modules, selected, activeModuleIds, project, onToggleModule, night, detail, cutaway }: StadiumViewerProps & Pick<ViewOptions, 'night' | 'detail' | 'cutaway'>) {
  const root = useRef<THREE.Group>(null);
  const model = useRef<ReturnType<typeof buildStadium> | null>(null);
  const invalidate = useThree(state => state.invalidate);
  const cutawayRef = useRef(cutaway); cutawayRef.current = cutaway;
  useEffect(() => {
    // Allocate GPU resources in an effect, not during render. This safely
    // handles React 18 StrictMode setup/cleanup/re-setup and suspended renders.
    const built = buildStadium(getStadiumDefinition(teamId), modules, { selected, activeModuleIds, project, night, detail });
    model.current = built;
    built.roofs.forEach(roof => { roof.visible = !cutawayRef.current; });
    const parent = root.current; parent?.add(built.group); invalidate();
    return () => { parent?.remove(built.group); built.dispose(); model.current = null; };
  }, [teamId, modules, selected, activeModuleIds, project, night, detail, invalidate]);
  useEffect(() => { model.current?.roofs.forEach(roof => { roof.visible = !cutaway; }); invalidate(); }, [cutaway, invalidate]);
  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > 5) return;
    const ids = event.object.userData.moduleIds as number[] | undefined;
    const id = event.instanceId !== undefined ? ids?.[event.instanceId] : event.object.userData.moduleId;
    if (typeof id === 'number') onToggleModule(id);
  };
  return <group ref={root} dispose={null} onClick={select}/>;
}

function CameraRig({ yaw, zoom, mode, teamId }: Pick<ViewOptions, 'yaw' | 'zoom' | 'mode'> & { teamId?: string }) {
  const { camera, invalidate } = useThree();
  const current = useRef({ yaw, zoom, elevation: mode === 'overview' ? 1 : 0 });
  const point = useRef(new THREE.Vector3());
  const definition = getStadiumDefinition(teamId);
  useEffect(() => { invalidate(); }, [yaw, zoom, mode, teamId, invalidate]);
  useFrame((_, delta) => {
    const state = current.current, dt = Math.min(delta, .05);
    const elevation = mode === 'overview' ? 1 : 0;
    state.yaw = THREE.MathUtils.damp(state.yaw, yaw, 9, dt);
    state.zoom = THREE.MathUtils.damp(state.zoom, zoom, 9, dt);
    state.elevation = THREE.MathUtils.damp(state.elevation, elevation, 9, dt);
    const extent = (47 + 4 * definition.rows * .8 + 12) * Math.max(definition.footprint.x, definition.footprint.z);
    const radius = extent * 1.65 * state.zoom * state.elevation;
    camera.position.set(Math.sin(state.yaw) * radius, 1.8 + extent * 1.1 * state.zoom * state.elevation, Math.cos(state.yaw) * radius);
    // Ground view faces outward; overview looks toward the centre.
    point.current.set(Math.sin(state.yaw) * 45 * (1-state.elevation), 3, Math.cos(state.yaw) * 45 * (1-state.elevation));
    camera.lookAt(point.current);
    if (Math.abs(state.yaw-yaw) + Math.abs(state.zoom-zoom) + Math.abs(state.elevation-elevation) > .0001) invalidate();
  });
  return null;
}

function Scene(props: StadiumViewerProps & ViewOptions) {
  return <>
    <color attach="background" args={[props.night ? '#101f33' : '#c4d7df']}/>
    <ambientLight intensity={props.night ? .65 : 1.2}/>
    <hemisphereLight args={[props.night ? '#849dc8' : '#d9edff', '#4a5138', props.night ? 1.1 : 1.5]}/>
    <directionalLight position={[60,100,30]} intensity={props.night ? 1.6 : 2.5}/>
    <Model {...props}/>
    <CameraRig {...props}/>
  </>;
}

export default function StadiumViewer3D(props: StadiumViewerProps) {
  const [yaw,setYaw] = useState(.65);
  const [zoom,setZoom] = useState(1);
  const [mode,setMode] = useState<CameraMode>('overview');
  const [cutaway,setCutaway] = useState(false);
  const drag = useRef<{ id: number; x: number; yaw: number } | null>(null);
  const definition = getStadiumDefinition(props.teamId);
  const clampZoom = (value: number) => Math.max(.65,Math.min(1.65,value));
  return <div
    role="region" aria-label={`${definition.name} 3D stadium`} tabIndex={0}
    style={{ position: 'relative', height: '100%', minHeight: 420, width: '100%', overflow: 'hidden', background: '#162936', touchAction: 'none' }}
    onPointerDown={event => {
      if ((event.target as HTMLElement).tagName !== 'CANVAS') return;
      drag.current = { id: event.pointerId, x: event.clientX, yaw };
      // Capture on the canvas so the final click still reaches R3F raycasting.
      (event.target as HTMLCanvasElement).setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => { if (drag.current?.id === event.pointerId) setYaw(drag.current.yaw - (event.clientX-drag.current.x)*.008); }}
    onPointerUp={event => { if (drag.current?.id === event.pointerId) drag.current = null; }}
    onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); setYaw(value=>value-.2); }
      if (event.key === 'ArrowRight') { event.preventDefault(); setYaw(value=>value+.2); }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(value=>clampZoom(value-.1)); }
      if (event.key === '-') { event.preventDefault(); setZoom(value=>clampZoom(value+.1)); }
    }}
  >
    <ViewerErrorBoundary key={props.teamId ?? 'KKR'}>
      <Canvas frameloop="demand" dpr={[1,1.5]} camera={{ position: [120,120,150], fov: 52, near: .1, far: 1200 }} gl={{ antialias: true }} fallback={<div style={{ padding: 24, color: 'white' }}>WebGL is unavailable. Use Plan view instead.</div>}>
        <Scene {...props} yaw={yaw} zoom={zoom} mode={mode} night={FIXED_NIGHT} cutaway={cutaway} detail={FIXED_DETAIL}/>
      </Canvas>
    </ViewerErrorBoundary>
    <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <button type="button" style={buttonStyle} onClick={()=>setMode(value=>value==='overview'?'ground':'overview')}>{mode==='overview'?'Ground view':'Overview'}</button>
      <button type="button" style={buttonStyle} aria-pressed={cutaway} onClick={()=>setCutaway(value=>!value)}>{cutaway?'Show roofs':'Hide roofs'}</button>
      <button type="button" style={buttonStyle} aria-label="Zoom in" disabled={mode==='ground'} onClick={()=>setZoom(value=>clampZoom(value-.1))}>+</button>
      <button type="button" style={buttonStyle} aria-label="Zoom out" disabled={mode==='ground'} onClick={()=>setZoom(value=>clampZoom(value+.1))}>−</button>
    </div>
    <div style={{ position: 'absolute', bottom: 14, left: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <button type="button" style={buttonStyle} aria-label="Turn left" onClick={()=>setYaw(value=>value-.3)}>‹</button>
      <span style={{ color: '#fff', background: '#10232bd9', padding: '6px 10px', borderRadius: 6, fontSize: 11, pointerEvents: 'none', textAlign: 'center' }}>Drag to rotate · Click a section · Architectural approximation</span>
      <button type="button" style={buttonStyle} aria-label="Turn right" onClick={()=>setYaw(value=>value+.3)}>›</button>
    </div>
  </div>;
}
