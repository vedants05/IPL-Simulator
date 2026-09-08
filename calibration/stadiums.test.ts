import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { StadiumMap } from '../components/club/stadiums/mappedSurroundings';
import * as THREE from 'three';
import { STADIUMS, getStadiumDefinition } from '../components/club/stadiums/definitions';
import { buildStadium, footprintPoint } from '../components/club/stadiums/buildStadium';
import { constructionProgress, resolveVisualModule } from '../components/club/stadiums/types';
import { inspectionPosition } from '../components/club/stadiums/inspectionCamera';
import { AdaptiveStadiumQuality } from '../components/club/stadiums/renderQuality';
import { STAND_DESIGNS } from '../components/club/stadiumVisualDesigns';
import { previewModules } from './stadiumFixtures';

assert.equal(Object.keys(STADIUMS).length,10);
assert.equal(getStadiumDefinition('mi').teamId,'MI');
assert.equal(getStadiumDefinition('unknown').teamId,'KKR');
const metrics: Record<string,unknown> = {};
for (const def of Object.values(STADIUMS)) {
  assert.equal(def.templates.length,8); assert.equal(def.roofs.length,8);
  assert(def.templates.every(template=>STAND_DESIGNS[template]));
  const modules = previewModules(def.teamId), snapshot = JSON.stringify(modules);
  const map:StadiumMap=JSON.parse(readFileSync(`public/stadiums/maps/${def.teamId}.json`,'utf8'));
  assert.equal(map.team,def.teamId);assert(map.features.length>0);
  assert.equal(modules.length,24);
  for (const detail of ['high','medium','low'] as const) {
    const built = buildStadium(def,modules,{detail,crowd:detail==='high',map});
    assert(built.group.getObjectByName('OpenStreetMap surroundings'));
    assert.equal(JSON.stringify(modules),snapshot,'Renderer must not mutate saves');
    assert(built.stats.seats>0); assert(built.stats.meshes<=110,'Budget includes separate glazing and masonry passes');
    let geometryDisposals=0, materialDisposals=0;
    const geometries=new Set<THREE.BufferGeometry>(), materials=new Set<THREE.Material>();
    built.group.updateMatrixWorld(true);
    built.group.traverse(object=>{
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      (Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));
      for (const name of ['position','normal','color']) {
        const attr=object.geometry.getAttribute(name);
        if (attr) Array.from(attr.array).forEach(value => assert(Number.isFinite(value),`${def.teamId} ${name}`));
      }
      if (object instanceof THREE.InstancedMesh) {
        assert.equal(object.userData.moduleIds.length,object.count);
        assert(object.userData.moduleIds.every((id:number)=>modules.some(module=>module.id===id)));
        Array.from(object.instanceMatrix.array).forEach(value => assert(Number.isFinite(value)));
      }
    });
    geometries.forEach(g=>g.addEventListener('dispose',()=>geometryDisposals++));
    materials.forEach(m=>m.addEventListener('dispose',()=>materialDisposals++));
    built.dispose(); built.dispose();
    assert.equal(geometryDisposals,geometries.size); assert.equal(materialDisposals,materials.size);
    metrics[`${def.teamId}-${detail}`]=built.stats;
  }
  const selected=buildStadium(def,modules,{selected:[0,1]}); selected.dispose();
  const cleared=buildStadium(def,modules.map(m=>({...m,empty:true}))); assert.equal(cleared.stats.seats,0); cleared.dispose();
  const empty=buildStadium(def,[]); assert.equal(empty.stats.seats,0); empty.dispose();
  assert(footprintPoint(def,44,0)[2]>0);
}
const entry=previewModules('KKR')[0];
const project={phase:'construction',action:'replace',templateId:'large-three',roof:'Cantilever',quality:'Elite'};
assert.equal(resolveVisualModule(entry,[0],project).entry.templateId,'large-three');
assert.equal(resolveVisualModule(entry,[0],{...project,action:'refurbish'}).entry.templateId,entry.templateId);
assert.equal(resolveVisualModule(entry,[0],{...project,phase:'cleared'}).entry.empty,true);
for (const phase of ['completed','cancelled']) assert.equal(resolveVisualModule(entry,[0],{...project,phase}).active,false);
const construction=buildStadium(STADIUMS.KKR,previewModules('KKR'),{activeModuleIds:[0,1],project}); construction.dispose();
// Exercise the browser-only artwork allocation path and its GPU lifecycle.
// This checks resource ownership; it is not a screenshot/visual-quality test.
const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
Object.defineProperty(globalThis,'document',{configurable:true,value:{
  createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})}),
}});
try {
  for (const def of Object.values(STADIUMS)) {
    const upgraded=previewModules(def.teamId).map(module=>({...module,templateId:'four-grandstand',quality:'Elite',roof:'Full roof'}));
    const built=buildStadium(def,upgraded,{night:true,detail:'high',crowd:true});
    const screens=built.group.children.filter(object=>object.name==='LED venue screen') as THREE.Mesh[];
    assert.equal(screens.length,def.screenAngles.length);
    for(const screen of screens) {
      const facing=new THREE.Vector3(0,0,1).applyQuaternion(screen.quaternion);
      const inward=screen.position.clone().setY(0).negate().normalize();
      assert(facing.dot(inward)>.98,'Scoreboards face the field, not the street');
      assert(screen.userData.inBowl,'Scoreboards use a stand-integrated media bay');
    }
    assert(built.stats.meshes<=110,'Upgraded browser model draw-call budget');
    const textures=new Set(screens.map(screen=>(screen.material as THREE.MeshBasicMaterial).map!));
    assert.equal(textures.size,1,'Screens share their venue texture');
    let disposals=0;
    textures.forEach(texture=>texture.addEventListener('dispose',()=>disposals++));
    built.dispose(); built.dispose();
    assert.equal(disposals,textures.size,'Screen textures disposed exactly once');
  }
} finally {
  if (originalDocument) Object.defineProperty(globalThis,'document',originalDocument);
  else Reflect.deleteProperty(globalThis,'document');
}
for(const templateId of ['classical-pavilion','art-deco-pavilion','garden-pavilion','sandstone-arcade','victorian-pavilion','glass-sky-lounge','tensile-terrace','asymmetric-grandstand']) {
  const built=buildStadium(STADIUMS.KKR,previewModules('KKR').map(module=>({...module,templateId})),{detail:'high'});
  assert(built.stats.seats>0);
  assert(built.stats.meshes<=110);
  built.dispose();
}
const dated={...project,constructionStartsOn:'2028-01-01',constructionCompletesOn:'2028-04-10'};
assert.equal(constructionProgress(dated,'2027-12-01'),0);
assert.equal(constructionProgress(dated,'2028-07-01'),1);
assert(constructionProgress(dated,'2028-02-01')>0&&constructionProgress(dated,'2028-02-01')<1);
for(const def of Object.values(STADIUMS)) {
  const modules=previewModules(def.teamId);
  for(const mode of ['seat','concourse','balcony','entrance'] as const) {
    const view=inspectionPosition(def,modules,[modules[3].id],mode);
    assert(view.position.every(Number.isFinite));assert(view.position[1]>0);
  }
}
const early=buildStadium(STADIUMS.KKR,[entry],{activeModuleIds:[entry.id],project:dated,currentDate:'2028-01-02'});
const late=buildStadium(STADIUMS.KKR,[entry],{activeModuleIds:[entry.id],project:dated,currentDate:'2028-04-09'});
assert.equal(early.stats.seats,0);assert.equal(late.stats.seats,0);
assert(late.stats.triangles>early.stats.triangles,'Dated construction gains structural geometry');
early.dispose();late.dispose();
const selectionModel=buildStadium(STADIUMS.KKR,previewModules('KKR'));
const selectedMesh=selectionModel.group.children.find(o=>o.userData.moduleId===0) as THREE.Mesh;
const originalMaterial=selectedMesh.material,originalGeometry=selectedMesh.geometry;
selectionModel.setSelection([0]);assert.notEqual(selectedMesh.material,originalMaterial);
selectionModel.setSelection([]);assert.equal(selectedMesh.material,originalMaterial);
assert.equal(selectedMesh.geometry,originalGeometry,'Selection must not rebuild the stadium');selectionModel.dispose();
const quality=new AdaptiveStadiumQuality();
for(let i=0;i<600;i++) quality.sample(1/25);
assert.equal(quality.scale,.85,'Sustained slow frames reduce resolution');
for(let i=0;i<5000;i++) quality.sample(1/90);
assert(quality.scale>1.6&&quality.scale<=1.75,'Sustained headroom restores detail');
const stable=quality.scale;for(let i=0;i<500;i++) quality.sample(3);
assert.equal(quality.scale,stable,'Idle demand-render gaps are not low FPS');
console.log(JSON.stringify(metrics,null,2));
console.log('PASS: 10 venues, three detail levels, crowds, new pavilion templates, maximum upgrades, finite geometry, instance IDs, save immutability, construction states, and disposal.');
