import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachEdenModules, EDEN_REGIONS, edenModuleAt, edenRegionsForObject } from '../components/club/stadiums/edenModules';
import { createEdenPlan, edenSelectionContiguous } from '../components/club/stadiums/edenPlan';

async function main() {
  // Texture decoding is irrelevant to geometry integrity. The browser smoke
  // test uses the real decoder and verifies shader compilation separately.
  Object.assign(globalThis,{self:globalThis,createImageBitmap:async()=>({width:1,height:1,close(){}})});
  const bytes=fs.readFileSync('public/stadiums/models/eden-gardens/eden-gardens-lod2.glb');
  assert.deepEqual(bytes,fs.readFileSync('stadium-pack/eden_gardens_site_v05/eden_gardens_exterior_LOD2.glb'),'Uploaded GLB must remain byte-identical');
  const {scene:source}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const scene=source.clone(true);
  const snapshot: Array<{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];matrix:number[];visible:boolean;count?:number;instances?:Float32Array}> = [];
  scene.updateMatrixWorld(true);
  scene.traverse(object=>{
    if(object instanceof THREE.Mesh) snapshot.push({mesh:object,geometry:object.geometry,material:object.material,matrix:object.matrixWorld.toArray(),visible:object.visible,
      count:object instanceof THREE.InstancedMesh?object.count:undefined,
      instances:object instanceof THREE.InstancedMesh?new Float32Array(object.instanceMatrix.array):undefined});
  });
  const beforeBounds=new THREE.Box3().setFromObject(scene);
  const adapter=attachEdenModules(scene);
  const all=Object.values(EDEN_REGIONS).flatMap(r=>[...r.ids]).sort((a,b)=>a-b);
  assert.deepEqual(all,Array.from({length:24},(_,i)=>i));
  for(const region of Object.values(EDEN_REGIONS)) {
    region.ids.forEach((id,i)=>{
      const value=region.start+(region.end-region.start)*(i+.5)/region.ids.length;
      const point=region.axis==='x'?{x:value,z:95}:{x:110*Math.sin(value),z:-110*Math.cos(value)};
      assert.equal(edenModuleAt([region],point),id);
    });
  }
  assert.equal(edenModuleAt(edenRegionsForObject(scene.getObjectByName('BC_curved_canopy')!),{x:110,z:0}),5);
  assert.equal(edenRegionsForObject(scene.getObjectByName('Outfield')!).length,0);
  assert.equal(edenRegionsForObject(scene.getObjectByName('H_T0_B00_shell')!)[0],EDEN_REGIONS.Stand_H);
  assert(edenSelectionContiguous([21,0,1]));
  assert(edenSelectionContiguous([22,23]));
  assert(!edenSelectionContiguous([21,22]));
  assert(!edenSelectionContiguous([0,3]));
  const plan=createEdenPlan(all.map(id=>({id,standName:'renamed',templateId:'standard-two',roof:'None',capacity:1,condition:75})));
  all.forEach(id=>assert(plan.section(id).endsWith(' Z')&&!plan.section(id).includes('NaN')));
  // Exercise every slot, shared roofs and project states, including clearing.
  for(const selected of [...all.map(id=>[id]),[2,3,4,5],[]]) {
    adapter.setState(selected,[15,16]);
    scene.updateMatrixWorld(true);
    snapshot.forEach(({mesh,geometry,matrix,visible,count,instances})=>{
      assert.equal(mesh.geometry,geometry);
      assert.deepEqual(mesh.matrixWorld.toArray(),matrix);
      assert.equal(mesh.visible,visible);
      if(mesh instanceof THREE.InstancedMesh) {
        assert.equal(mesh.count,count);
        assert.deepEqual(mesh.instanceMatrix.array,instances);
      }
    });
  }
  assert(beforeBounds.equals(new THREE.Box3().setFromObject(scene)));
  const mesh=scene.getObjectByName('BC_curved_canopy') as THREE.Mesh;
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  (mesh.material as THREE.Material).onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);
  assert(shader.fragmentShader.includes('edenState[4]'));
  assert(!shader.fragmentShader.includes('clippingPlanes'));
  adapter.dispose();
  snapshot.forEach(({mesh,material})=>assert.equal(mesh.material,material));
  const again=attachEdenModules(scene);again.setState([0]);again.dispose();
  snapshot.forEach(({mesh,material})=>assert.equal(mesh.material,material));
  console.log(`PASS: all 24 slots; ${snapshot.length} meshes unchanged; instancing, bounds, transforms, shared roofs, restoration and original GLB preserved.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
