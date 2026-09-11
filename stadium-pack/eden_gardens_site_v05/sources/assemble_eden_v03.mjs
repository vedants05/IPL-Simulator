import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments,unpartition} from '@gltf-transform/functions';
import validator from 'gltf-validator';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const out=process.argv[2]||'eden_gardens_model_v03';
const reports=[];
for(let level=0;level<4;level++){
 const doc=await io.read(`eden_gardens_model_v02/eden_gardens_LOD${level}.glb`);
 // The new photo-based V braces replace the older generic X braces.
 for(const node of doc.getRoot().listNodes())if(/^(BC|KL)_exterior_bracing$/.test(node.getName()))node.dispose();
 if(out.includes('site_v05')){
   const manifest=JSON.parse(fs.readFileSync(`${out}/exterior_manifest.json`,'utf8'));
   for(const node of doc.getRoot().listNodes())if(node.getName()==='Site_pad_basic')node.dispose();
   for(const tower of manifest.towers){
     const [ox,oy]=tower.old_local_xy_m,[nx,ny]=tower.new_local_xy_m;
     const angle=Math.atan2(ox,oy)-Math.atan2(nx,ny),c=Math.cos(angle),s=Math.sin(angle);
     const visited=new Set();
     for(const node of doc.getRoot().listNodes())if(node.getName().startsWith(`${tower.name}_`)&&node.getMesh()){
       for(const primitive of node.getMesh().listPrimitives()){
         const pos=primitive.getAttribute('POSITION'),normal=primitive.getAttribute('NORMAL');
         if(!visited.has(pos)){visited.add(pos);const a=pos.getArray();for(let i=0;i<a.length;i+=3){const x=a[i]-ox,y=-a[i+2]-oy;a[i]=nx+c*x-s*y;a[i+2]=-(ny+s*x+c*y);}}
         if(normal&&!visited.has(normal)){visited.add(normal);const a=normal.getArray();for(let i=0;i<a.length;i+=3){const x=a[i],y=-a[i+2];a[i]=c*x-s*y;a[i+2]=-(s*x+c*y);}}
       }
     }
   }
 }
 const addition=await io.read(`${out}/eden_exterior_context.glb`);
 const map=mergeDocuments(doc,addition);
 const scene=doc.getRoot().getDefaultScene();
 const source=map.get(addition.getRoot().getDefaultScene());
 const outer=doc.createNode('Eden_Exterior_and_Context_v03').setExtras({units:'metres',mapSource:'OpenStreetMap contributors',geographicYawEstimated:true});
 for(const child of source.listChildren())outer.addChild(child);
 scene.addChild(outer);source.dispose();
 if(out.includes('frontage')||out.includes('site_v05')){
   const font=new FontLoader().parse(JSON.parse(fs.readFileSync('model_tools/node_modules/three/examples/fonts/helvetiker_regular.typeface.json','utf8')));
   const geometry=new TextGeometry('THE CRICKET ASSOCIATION OF BENGAL',{font,size:.58,depth:.045,curveSegments:3,bevelEnabled:false});
   geometry.computeBoundingBox();const width=geometry.boundingBox.max.x-geometry.boundingBox.min.x;
   geometry.translate(-width/2,4.35,out.includes('site_v05')?117.36:137.36);
   const buffer=doc.getRoot().listBuffers()[0];
   const pos=doc.createAccessor().setType('VEC3').setArray(geometry.attributes.position.array).setBuffer(buffer);
   const normals=doc.createAccessor().setType('VEC3').setArray(geometry.attributes.normal.array).setBuffer(buffer);
   const material=doc.createMaterial('CAB raised white lettering').setBaseColorFactor([.87,.88,.86,1]).setRoughnessFactor(.6);
   const primitive=doc.createPrimitive().setAttribute('POSITION',pos).setAttribute('NORMAL',normals).setMaterial(material);
   outer.addChild(doc.createNode('CAB_raised_lettering').setMesh(doc.createMesh('CAB_raised_lettering').addPrimitive(primitive)));
   geometry.dispose();
 }
 await doc.transform(unpartition());
 const path=`${out}/eden_gardens_exterior_LOD${level}.glb`;
 await io.write(path,doc);
 const result=await validator.validateBytes(new Uint8Array(fs.readFileSync(path)),{uri:path,maxIssues:12});
 reports.push({file:path.split('/').pop(),bytes:fs.statSync(path).size,errors:result.issues.numErrors,warnings:result.issues.numWarnings,notes:result.issues.messages});
 console.log(reports.at(-1));
 if(result.issues.numErrors)throw new Error('GLB validation failed');
}
fs.writeFileSync(`${out}/validation_summary.json`,JSON.stringify(reports,null,2));
