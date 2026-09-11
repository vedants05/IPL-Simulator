"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildStadium } from './stadiums/buildStadium';
import { getStadiumDefinition } from './stadiums/definitions';
import type { DetailLevel, StadiumViewerProps } from './stadiums/types';
import { inspectionPosition, type CameraMode } from './stadiums/inspectionCamera';
import type { StadiumMap } from './stadiums/mappedSurroundings';
import { AdaptiveStadiumQuality, createStadiumPostprocessing, initialStadiumScale } from './stadiums/renderQuality';
import { stadiumExtent } from './stadiums/siteGeometry';
import ImportedEdenStadium from './stadiums/ImportedEdenStadium';
import { EDEN_CAMERA_PRESETS, EDEN_MODEL_URLS } from './stadiums/edenGardensAsset';

interface ViewOptions { yaw: number; zoom: number; mode: CameraMode; night: boolean; cutaway: boolean; detail: DetailLevel; crowd: boolean; focusId?: number }
const buttonStyle = { border: '1px solid #ffffff50', background: '#10232be8', color: '#f4f0dc', borderRadius: 6, padding: '6px 9px', fontSize: 12, cursor: 'pointer' } as const;
const FIXED_NIGHT = true;
const FIXED_DETAIL: DetailLevel = 'high';

class ViewerErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert" style={{ padding: 28, color: 'white' }}>The 3D viewer could not start. Return to Plan view, or try a browser with WebGL enabled.</div> : this.props.children;
  }
}

function Model({ teamId, modules, selected, activeModuleIds, project, currentDate, onToggleModule, night, detail, cutaway, crowd, mode }: StadiumViewerProps & Pick<ViewOptions, 'night' | 'detail' | 'cutaway' | 'crowd' | 'mode'>) {
  const root = useRef<THREE.Group>(null);
  const model = useRef<ReturnType<typeof buildStadium> | null>(null);
  const [map,setMap]=useState<StadiumMap>();
  const eden=getStadiumDefinition(teamId).teamId==='KKR';
  useEffect(()=>{
    const controller=new AbortController();setMap(undefined);
    if(eden) return ()=>controller.abort();
    const id=getStadiumDefinition(teamId).teamId;
    fetch(`/stadiums/maps/${id}.json`,{signal:controller.signal})
      .then(response=>{if(!response.ok) throw new Error('Map unavailable');return response.json();})
      .then((data:StadiumMap)=>{if(!controller.signal.aborted && data.team===id && Array.isArray(data.features)) setMap(data);})
      .catch(error=>{if(error.name!=='AbortError') console.warn('Stadium map unavailable',error);});
    return ()=>controller.abort();
  },[teamId,eden]);
  const invalidate = useThree(state => state.invalidate);
  const cutawayRef = useRef(cutaway); cutawayRef.current = cutaway;
  const selectionRef=useRef(selected);selectionRef.current=selected;
  const gl=useThree(state=>state.gl);
  useEffect(() => {
    // Eden uses the uploaded GLB exclusively. Do not layer the procedural bowl,
    // roofs, field or surroundings over the authored model.
    if(eden) { model.current=null; invalidate(); return; }
    // Allocate GPU resources in an effect, not during render. This safely
    // handles React 18 StrictMode setup/cleanup/re-setup and suspended renders.
    const built = buildStadium(getStadiumDefinition(teamId), modules, { selected:selectionRef.current, activeModuleIds, project, currentDate, night, detail, crowd, map:map?.team===getStadiumDefinition(teamId).teamId?map:undefined });
    model.current = built;
    built.roofs.forEach(roof => { roof.visible = !cutawayRef.current; });
    const parent = root.current; parent?.add(built.group); gl.shadowMap.needsUpdate=true; invalidate();
    return () => { parent?.remove(built.group); built.dispose(); model.current = null; };
  }, [teamId, modules, activeModuleIds, project, currentDate, night, detail, crowd, map, invalidate,gl,eden]);
  useEffect(()=>{model.current?.setSelection(selected);invalidate();},[selected,invalidate]);
  const reducedMotion=useRef(false);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const change=()=>{reducedMotion.current=media.matches; invalidate();}; change();
    media.addEventListener('change',change); return ()=>media.removeEventListener('change',change);
  },[invalidate]);
  useFrame(({clock})=>{if(crowd&&!reducedMotion.current) {model.current?.animate(clock.elapsedTime); invalidate();}});
  useEffect(() => { model.current?.roofs.forEach(roof => { roof.visible = !cutaway; }); gl.shadowMap.needsUpdate=true; invalidate(); }, [cutaway, invalidate,gl]);
  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > 5) return;
    const ids = event.object.userData.moduleIds as number[] | undefined;
    const id = event.instanceId !== undefined ? ids?.[event.instanceId] : event.object.userData.moduleId;
    if (typeof id === 'number') onToggleModule(id);
  };
  return <group dispose={null} onClick={select}>
    {eden&&<Suspense fallback={null}><ImportedEdenStadium url={EDEN_MODEL_URLS.detail} selected={selected} activeModuleIds={activeModuleIds} onToggleModule={onToggleModule}/></Suspense>}
    <group ref={root}/>
  </group>;
}

function CameraRig({ yaw, zoom, mode, teamId, modules, selected }: Pick<ViewOptions, 'yaw' | 'zoom' | 'mode'> & StadiumViewerProps) {
  const { camera, invalidate } = useThree();
  const current = useRef({ yaw, zoom, elevation: mode === 'overview' ? 1 : 0 });
  const point = useRef(new THREE.Vector3());
  const targetPosition=useRef(new THREE.Vector3());
  const targetLook=useRef(new THREE.Vector3());
  const definition = getStadiumDefinition(teamId);
  const extent=useMemo(()=>stadiumExtent(definition,modules),[definition,modules]);
  const inspection=useMemo(()=>mode==='overview'||mode==='ground'?null:inspectionPosition(definition,modules,selected,mode),[definition,modules,selected,mode]);
  const edenPreset=definition.teamId==='KKR'?EDEN_CAMERA_PRESETS[mode]:undefined;
  useEffect(() => { invalidate(); }, [yaw, zoom, mode, teamId, modules, selected, invalidate]);
  useFrame((_, delta) => {
    const state = current.current, dt = Math.min(delta, .05);
    const elevation = mode === 'overview' || edenPreset ? 1 : 0;
    state.yaw = THREE.MathUtils.damp(state.yaw, yaw, 9, dt);
    state.zoom = THREE.MathUtils.damp(state.zoom, zoom, 9, dt);
    state.elevation = THREE.MathUtils.damp(state.elevation, elevation, 9, dt);
    const aspect=camera instanceof THREE.PerspectiveCamera?camera.aspect:1;
    const framing=Math.max(1,1.25/Math.max(.4,aspect));
    const radius = extent * 1.65 * state.zoom * state.elevation * framing;
    targetPosition.current.set(Math.sin(state.yaw) * radius, 1.8 + extent * 1.1 * state.zoom * state.elevation * framing, Math.cos(state.yaw) * radius);
    // Ground view faces outward; overview looks toward the centre.
    targetLook.current.set(Math.sin(state.yaw) * 45 * (1-state.elevation), 3, Math.cos(state.yaw) * 45 * (1-state.elevation));
    if(inspection) {
      const view=inspection;
      targetPosition.current.set(...view.position);
      const facing=view.facingAngle+(state.yaw-.65);
      targetLook.current.copy(targetPosition.current).add(new THREE.Vector3(Math.sin(facing)*25,mode==='seat'||mode==='balcony'?-5:0,Math.cos(facing)*25));
    }
    if(edenPreset) {
      targetPosition.current.set(...edenPreset.position);
      targetLook.current.set(...edenPreset.target);
    }
    const blend=1-Math.exp(-8*dt);
    camera.position.lerp(targetPosition.current,blend); point.current.lerp(targetLook.current,blend);
    if(camera instanceof THREE.PerspectiveCamera) {
      const fov=edenPreset?.fov??(mode==='overview'||mode==='ground'?52:52*state.zoom);
      if(Math.abs(camera.fov-fov)>.001) {camera.fov=fov;camera.updateProjectionMatrix();}
    }
    camera.lookAt(point.current);
    if (camera.position.distanceTo(targetPosition.current)+point.current.distanceTo(targetLook.current)+Math.abs(state.yaw-yaw) + Math.abs(state.zoom-zoom) + Math.abs(state.elevation-elevation) > .001) invalidate();
  });
  return null;
}

function Scene(props: StadiumViewerProps & ViewOptions) {
  const {gl,scene,invalidate}=useThree();
  useEffect(()=>{
    const generator=new THREE.PMREMGenerator(gl),room=new RoomEnvironment();
    const environment=generator.fromScene(room,.04),previous=scene.environment,previousIntensity=scene.environmentIntensity;
    scene.environment=environment.texture;scene.environmentIntensity=.2; invalidate();
    return ()=>{scene.environment=previous;scene.environmentIntensity=previousIntensity; environment.dispose(); room.dispose(); generator.dispose();};
  },[gl,scene,invalidate]);
  const [detail,setDetail]=useState<DetailLevel>('high');
  useFrame(({camera})=>{
    const distance=camera.position.length();
    if(props.mode!=='overview'&&detail!=='high') setDetail('high');
    else if(props.mode==='overview'&&distance>300&&detail==='high') setDetail('medium');
    else if(distance<240&&detail==='medium') setDetail('high');
  });
  return <>
    <color attach="background" args={[props.night ? '#101f33' : '#c4d7df']}/>
    <fog attach="fog" args={['#101f33',350,950]}/>
    <ambientLight intensity={props.night ? .22 : 1.2}/>
    <hemisphereLight args={[props.night ? '#849dc8' : '#d9edff', '#39412e', props.night ? .65 : 1.5]}/>
    <directionalLight position={[60,140,30]} intensity={props.night ? 1.25 : 2.5} castShadow
      shadow-mapSize={[2048,2048]} shadow-camera-left={-210} shadow-camera-right={210}
      shadow-camera-top={210} shadow-camera-bottom={-210} shadow-camera-far={500}
      shadow-normalBias={.12} shadow-bias={-.00015}/>
    <directionalLight position={[-70,90,-60]} color="#d3e2ff" intensity={.4}/>
    <Model {...props} detail={detail}/>
    <CameraRig {...props} selected={props.focusId===undefined?props.selected:[props.focusId]}/>
    <Presentation/>
  </>;
}

function Presentation() {
  const {gl,scene,camera,size,invalidate}=useThree();
  const pipeline=useRef<ReturnType<typeof createStadiumPostprocessing>>();
  const quality=useRef(new AdaptiveStadiumQuality());
  useEffect(()=>{
    const previous=gl.shadowMap.autoUpdate,oldExposure=gl.toneMappingExposure;
    gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;gl.toneMappingExposure=1;
    quality.current.scale=initialStadiumScale(gl);
    const effects=createStadiumPostprocessing(gl,scene,camera);pipeline.current=effects;invalidate();
    return ()=>{pipeline.current=undefined;effects.dispose();gl.shadowMap.autoUpdate=previous;gl.toneMappingExposure=oldExposure;};
  },[gl,scene,camera,invalidate]);
  useEffect(()=>{pipeline.current?.resize(size.width,size.height,quality.current.scale);invalidate();},[size.width,size.height,invalidate]);
  useFrame((_,delta)=>{
    if(quality.current.sample(delta)) pipeline.current?.resize(size.width,size.height,quality.current.scale);
    if(pipeline.current) pipeline.current.render(Math.min(delta,.05));else gl.render(scene,camera);
  },1);
  return null;
}

export default function StadiumViewer3D(props: StadiumViewerProps) {
  const [yaw,setYaw] = useState(.65);
  const [zoom,setZoom] = useState(1);
  const [mode,setMode] = useState<CameraMode>('overview');
  const [cutaway,setCutaway] = useState(false);
  const [crowd,setCrowd] = useState(false);
  const [focusId,setFocusId]=useState<number>();
  useEffect(()=>setFocusId(undefined),[props.selected,props.teamId]);
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
      <Canvas shadows frameloop="demand" dpr={[1,1.75]} camera={{ position: [120,120,150], fov: 52, near: .1, far: 6000 }} gl={{ antialias: true, powerPreference:'high-performance' }} fallback={<div style={{ padding: 24, color: 'white' }}>WebGL is unavailable. Use Plan view instead.</div>}>
        <Scene {...props} yaw={yaw} zoom={zoom} mode={mode} night={FIXED_NIGHT} cutaway={cutaway} detail={FIXED_DETAIL} crowd={crowd} focusId={focusId}/>
      </Canvas>
    </ViewerErrorBoundary>
    <div style={{position:'absolute',bottom:58,left:12,maxWidth:'calc(100% - 24px)',fontSize:10,color:'#dde6ea',background:'#10232be8',padding:'4px 7px',borderRadius:4}}>
      Map geometry: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{color:'inherit'}}>© OpenStreetMap contributors · ODbL</a>
      {' · Heights estimated · Bowl/concourse schematic'}
    </div>
    <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <select aria-label="Inspection camera" style={buttonStyle} value={mode} onChange={event=>{setMode(event.target.value as CameraMode); setYaw(.65);}}>
        <option value="overview">Overview</option><option value="ground">Ground view</option>
        <option value="seat">Selected stand: seat</option><option value="concourse">Selected stand: concourse</option>
        <option value="balcony">Selected stand: balcony</option><option value="entrance">Selected stand: entrance</option>
        {definition.teamId==='KKR'&&<><option value="broadcast">Eden: broadcast aerial</option><option value="pavilionRoad">Eden: pavilion road</option><option value="maidan">Eden: Maidan</option><option value="river">Eden: river panorama</option><option value="construction">Eden: construction overview</option></>}
      </select>
      {mode!=='overview'&&mode!=='ground'&&<select aria-label="Stand to inspect" style={{...buttonStyle,maxWidth:210}} value={focusId??props.selected[props.selected.length-1]??props.modules[0]?.id??''} onChange={event=>setFocusId(Number(event.target.value))}>
        {props.modules.map(module=><option key={module.id} value={module.id}>{module.standName} · {module.id+1}</option>)}
      </select>}
      {definition.teamId!=='KKR'&&<button type="button" style={buttonStyle} aria-pressed={cutaway} onClick={()=>setCutaway(value=>!value)}>{cutaway?'Show roofs':'Hide roofs'}</button>}
      {definition.teamId!=='KKR'&&<button type="button" style={buttonStyle} aria-pressed={crowd} onClick={()=>setCrowd(value=>!value)} title="Decorative crowd preview; does not represent match attendance">{crowd?'Hide crowd':'Preview crowd'}</button>}
      <button type="button" style={buttonStyle} aria-label="Zoom in" disabled={mode==='ground'} onClick={()=>setZoom(value=>clampZoom(value-.1))}>+</button>
      <button type="button" style={buttonStyle} aria-label="Zoom out" disabled={mode==='ground'} onClick={()=>setZoom(value=>clampZoom(value+.1))}>−</button>
    </div>
    <div style={{ position: 'absolute', bottom: 14, left: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <button type="button" style={buttonStyle} aria-label="Turn left" onClick={()=>setYaw(value=>value-.3)}>‹</button>
      <span style={{ color: '#fff', background: '#10232bd9', padding: '6px 10px', borderRadius: 6, fontSize: 11, pointerEvents: 'none', textAlign: 'center' }}>{definition.teamId==='KKR'?'Drag to rotate · Click a section · Original geometry preserved':'Drag to rotate · Click a section · Architectural approximation'}</span>
      <button type="button" style={buttonStyle} aria-label="Turn right" onClick={()=>setYaw(value=>value+.3)}>›</button>
    </div>
  </div>;
}
