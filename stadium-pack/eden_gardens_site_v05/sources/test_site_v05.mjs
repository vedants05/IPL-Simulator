import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
const manifest=JSON.parse(await fs.readFile('eden_gardens_site_v05/exterior_manifest.json','utf8'));
const loader=new GLTFLoader(),results=[];
for(let level=0;level<4;level++){
 const raw=await fs.readFile(`eden_gardens_site_v05/eden_gardens_exterior_LOD${level}.glb`);
 const {scene}=await loader.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
 scene.updateMatrixWorld(true);let seats=0,triangles=0;
 scene.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(o.isInstancedMesh&&o.name.endsWith('_shell'))seats+=o.count;}});
 if(level<3&&seats!==50498)throw new Error('Seat instances changed');
 const towerChecks=[];
 for(const t of manifest.towers){
  const base=scene.getObjectByName(t.name+'_foundation');if(!base)throw new Error('Missing tower foundation');
  const p=new THREE.Box3().setFromObject(base).getCenter(new THREE.Vector3());
  const error=Math.hypot(p.x-t.new_local_xy_m[0],-p.z-t.new_local_xy_m[1]);if(error>.01)throw new Error('Tower location mismatch');towerChecks.push({tower:t.name,error_m:error});
 }
 for(const g of manifest.gates){const mesh=scene.getObjectByName('Gate_'+g.name);if(!mesh)throw new Error('Missing gate');}
 for(const name of ['Maidan_mapped_park_boundary','Mapped_public_roads','Hooghly_River_OSM_shoreline','Site_boundary_masonry','Pavilion_upper_blue_glass'])if(!scene.getObjectByName(name))throw new Error('Missing '+name);
 if(scene.getObjectByName('Site_pad_basic'))throw new Error('Circular site pad survived');
 results.push({level,seats,expandedTriangles:triangles,towerChecks});
}
await fs.writeFile('eden_gardens_site_v05/three_geometry_test.json',JSON.stringify({status:'passed',threeRevision:THREE.REVISION,results,notTested:['WebGL rendering','browser frame rate','image decode (mocked in Node)']},null,2));console.log(results);
