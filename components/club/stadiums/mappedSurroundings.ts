import * as THREE from 'three';
import { radialSample, siteLayout } from './siteGeometry';
import { getStadiumDefinition } from './definitions';

export interface StadiumMap {
  team: string;
  source: string;
  fetchedAt: string;
  features: {id:number;tags:Record<string,string>;points:[number,number][];closed:boolean}[];
}

// Fixed metric frame: X east, Z south, Y up. Never stretched for upgrades.
// Footprints are mapped; untagged heights and widths are explicitly estimates.
export function buildMappedSurroundings(data:StadiumMap):THREE.Group {
  const group=new THREE.Group(); group.name='OpenStreetMap surroundings';
  const layout=siteLayout(getStadiumDefinition(data.team).teamId);
  const inBowl=(x:number,z:number,margin=0)=>Math.hypot(x,z)<radialSample(layout.outerR,Math.atan2(x,z))+margin;
  const positions:number[]=[],colors:number[]=[];
  const walls:number[]=[],wallColors:number[]=[],wallUv:number[]=[];
  const wall=(a:THREE.Vector2,b:THREE.Vector2,height:number,color:string,seed:number)=>{
    const span=a.distanceTo(b),rgb=new THREE.Color(color);
    const corners=[[a.x,-.7,a.y],[b.x,-.7,b.y],[b.x,height,b.y],[a.x,height,a.y]];
    const uv=[[seed,0],[seed+span/2.7,0],[seed+span/2.7,(height+.7)/3],[seed,(height+.7)/3]];
    for(const i of [0,1,2,0,2,3]) {walls.push(...corners[i]);wallUv.push(...uv[i]);wallColors.push(rgb.r,rgb.g,rgb.b);}
  };
  const triangle=(a:number[],b:number[],c:number[],hex:string)=>{
    const color=new THREE.Color(hex);
    positions.push(...a,...b,...c);
    for(let i=0;i<3;i++) colors.push(color.r,color.g,color.b);
  };
  const containsPoint=(points:[number,number][],px=0,pz=0)=>{
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++) {
      const [x,z]=points[i],[a,b]=points[j];
      if((z>pz)!==(b>pz) && px<(a-x)*(pz-z)/(b-z)+x) inside=!inside;
    }
    return inside;
  };
  for(const feature of data.features) {
    const {tags:t,points}=feature;
    if(points.length<2 || points.some(p=>!p.every(Number.isFinite))) continue;
    if(t.tunnel==='yes'||t.location==='underground'||Number(t.layer)<0) continue;
    const building=!!t.building;
    if(building && (layout.outerSources.includes(`way/${feature.id}`) || (t.building==='stadium'&&points.every(([x,z])=>inBowl(x,z,2))))) continue;
    // The game's editable bowl replaces the real bowl, not nearby buildings.
    if((building||t.leisure==='pitch'||t.leisure==='stadium') && feature.closed && containsPoint(points)) continue;
    if(feature.closed && (building||t.natural==='water'||t.landuse||t.leisure||t.amenity==='parking')) {
      const ring=points.slice(0,-1).map(([x,z])=>new THREE.Vector2(x,z));
      if(ring.length<3) continue;
      const taggedHeight=Number.parseFloat(t.height),levels=Number.parseFloat(t['building:levels']);
      const height=building?Math.max(2,Math.min(150,Number.isFinite(taggedHeight)?taggedHeight:Number.isFinite(levels)?levels*3:9)):-.25;
      const green=['grass','forest','meadow','recreation_ground','village_green'].includes(t.landuse)||['park','garden','pitch'].includes(t.leisure);
      const color=building?['#929b99','#a49b8e','#8f9c9f','#a5a195'][feature.id%4]:t.natural==='water'?'#365b6c':green?'#466348':'#62696a';
      for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(ring,[])) {
        triangle([ring[a].x,height,ring[a].y],[ring[c].x,height,ring[c].y],[ring[b].x,height,ring[b].y],color);
      }
      if(building) for(let i=0;i<ring.length;i++) {
        const a=ring[i],b=ring[(i+1)%ring.length];
        wall(a,b,height,color,feature.id%73);
        // Generic coping detail follows the original footprint. Facades are
        // visual treatments, not evidence of actual window or parapet layouts.
        const dx=b.x-a.x,dz=b.y-a.y,length=Math.hypot(dx,dz);
        if(length>.01) {
          const x=-dz/length*.18,z=dx/length*.18;
          triangle([a.x,height+.24,a.y],[b.x,height+.24,b.y],[b.x+x,height+.24,b.y+z],'#b6b7ad');
          triangle([a.x,height+.24,a.y],[b.x+x,height+.24,b.y+z],[a.x+x,height+.24,a.y+z],'#b6b7ad');
        }
      }
    } else if(t.highway||t.railway) {
      const explicitWidth=Number.parseFloat(t.width);
      const width=Number.isFinite(explicitWidth)?Math.max(.5,Math.min(30,explicitWidth)):t.railway?2:['footway','path','steps','cycleway'].includes(t.highway)?1.8:['primary','secondary','trunk'].includes(t.highway)?10:5;
      for(let i=1;i<points.length;i++) {
        const [x,z]=points[i-1],[a,b]=points[i],length=Math.hypot(a-x,b-z);
        if(length<.01) continue;
        const dx=(b-z)/length*width/2,dz=-(a-x)/length*width/2;
        const y=t.bridge?1:-.12,color=t.railway?'#777d7d':width<3?'#aaa696':'#3e464b';
        triangle([x-dx,y,z-dz],[a+dx,y,b+dz],[x+dx,y,z+dz],color);
        triangle([x-dx,y,z-dz],[a-dx,y,b-dz],[a+dx,y,b+dz],color);
      }
    }
  }
  // Decorative vegetation constrained to mapped park/woodland polygons.
  // No invented buildings, no trees sprinkled across roads or playing fields.
  const buildings=data.features.filter(f=>f.closed&&f.tags.building);
  const roads=data.features.filter(f=>f.tags.highway||f.tags.railway);
  let trees=0;
  for(const f of data.features) {
    if(!f.closed||!(f.tags.leisure==='park'||f.tags.leisure==='garden'||f.tags.landuse==='forest')) continue;
    const xs=f.points.map(p=>p[0]),zs=f.points.map(p=>p[1]);
    const minX=Math.max(-420,Math.min(...xs)),maxX=Math.min(420,Math.max(...xs));
    const minZ=Math.max(-420,Math.min(...zs)),maxZ=Math.min(420,Math.max(...zs));
    for(let cellX=minX+8;cellX<maxX&&trees<220;cellX+=22) for(let cellZ=minZ+8;cellZ<maxZ&&trees<220;cellZ+=22) {
      const seed=(Math.imul(Math.floor(cellX)+701,73856093)^Math.imul(Math.floor(cellZ)+901,19349663)^f.id)>>>0;
      const x=cellX+(seed%100)/100*13-6.5,z=cellZ+((seed>>>8)%100)/100*13-6.5;
      if(inBowl(x,z,8)||!containsPoint(f.points,x,z)||buildings.some(b=>containsPoint(b.points,x,z))) continue;
      const nearRoad=roads.some(road=>road.points.some(([a,b],i)=>{
        if(!i) return false;
        const [c,d]=road.points[i-1],length=(a-c)**2+(b-d)**2;
        const t=length?Math.max(0,Math.min(1,((x-c)*(a-c)+(z-d)*(b-d))/length)):0;
        return Math.hypot(x-c-t*(a-c),z-d-t*(b-d))<7;
      }));
      if(nearRoad) continue;
      const height=5+(trees%5)*.6,radius=2.7+(trees%3)*.35;trees++;
      for(let face=0;face<8;face++) {
        const a=face/8*Math.PI*2,b=(face+1)/8*Math.PI*2;
        triangle([x+Math.sin(a)*.18,-.65,z+Math.cos(a)*.18],[x+Math.sin(b)*.18,-.65,z+Math.cos(b)*.18],[x,height-1,z],'#665844');
        for(let ring=0;ring<6;ring++) {
          const y=ring/6*Math.PI,v=(ring+1)/6*Math.PI;
          const p=(angle:number,phi:number)=>[x+Math.sin(angle)*Math.sin(phi)*radius,height+Math.cos(phi)*radius,z+Math.cos(angle)*Math.sin(phi)*radius];
          triangle(p(a,y),p(b,y),p(b,v),face%3?'#3d6545':'#52764b');
          triangle(p(a,y),p(b,v),p(a,v),face%3?'#3d6545':'#52764b');
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,side:THREE.DoubleSide}));
  mesh.name='Mapped footprints and routes (estimated heights)';mesh.receiveShadow=true;
  mesh.raycast=()=>{};group.add(mesh);
  const facadeGeometry=new THREE.BufferGeometry();
  facadeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(walls,3));
  facadeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(wallColors,3));
  facadeGeometry.setAttribute('facadeUv',new THREE.Float32BufferAttribute(wallUv,2));
  facadeGeometry.computeVertexNormals();facadeGeometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec2 facadeUv; varying vec2 vFacadeUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFacadeUv=facadeUv;');
    shader.fragmentShader='varying vec2 vFacadeUv;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 cell=floor(vFacadeUv), tile=fract(vFacadeUv);
      vec2 edge=max(fwidth(vFacadeUv),vec2(0.002));
      float pane=smoothstep(.17,.17+edge.x,tile.x)*(1.0-smoothstep(.78,.78+edge.x,tile.x))*smoothstep(.27,.27+edge.y,tile.y)*(1.0-smoothstep(.82,.82+edge.y,tile.y));
      float lit=step(.78,fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453));
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.025,.045,.055),vec3(.19,.15,.09),lit),pane);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=pane*lit*vec3(.26,.18,.08);');
  };
  material.customProgramCacheKey=()=> 'stadium-mapped-facades-v1';
  const facades=new THREE.Mesh(facadeGeometry,material);facades.name='Generic facade detail on mapped footprints';
  facades.raycast=()=>{};facades.receiveShadow=true;group.add(facades);
  return group;
}
