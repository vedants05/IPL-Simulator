import * as THREE from 'three';
import { STAND_DESIGNS, edenExistingBoxes } from '../stadiumVisualDesigns';
import type { StadiumDefinition } from './definitions';
import { buildMappedSurroundings, type StadiumMap } from './mappedSurroundings';
import { constructionProgress, resolveVisualModule, type DetailLevel, type ViewerModule, type ViewerProject } from './types';
import { footprintPoint, metricRadius, moduleAngle, moduleIndexAt, sectionDefinitions, surfaceYaw, templateRear, templateRadiusForMetres, venueVisualModule, PITCH_LENGTH, PITCH_WIDTH } from './siteGeometry';
export { footprintPoint } from './siteGeometry';

type Point = [number, number, number];
const TAU = Math.PI * 2;
const RUN = .8;
const RISE = .43;
const INNER = 47;
const shadeCache=new Map<string,string>();
function shaded(color:string,factor:number) {
  const key=`${color}:${factor}`;
  let value=shadeCache.get(key);
  if(!value) {value=`#${new THREE.Color(color).multiplyScalar(factor).getHexString()}`;shadeCache.set(key,value);}
  return value;
}
export const NO_RAYCAST: THREE.Object3D['raycast'] = () => {};

// A closed, vertex-coloured triangle batch. Terraces become one mesh per
// section instead of a draw call for every row. No BufferGeometryUtils needed.
class Surface {
  private positions: number[] = [];
  private colors: number[] = [];
  private colorCache = new Map<string, THREE.Color>();
  triangle(a: Point, b: Point, c: Point, color: string) {
    let rgb = this.colorCache.get(color);
    if (!rgb) { rgb = new THREE.Color(color); this.colorCache.set(color, rgb); }
    for (const point of [a, b, c]) {
      this.positions.push(...point);
      this.colors.push(rgb.r, rgb.g, rgb.b);
    }
  }
  quad(a: Point, b: Point, c: Point, d: Point, color: string) {
    this.triangle(a, b, c, color); this.triangle(a, c, d, color);
  }
  box(center: Point, size: Point, color: string, yaw = 0) {
    const points: Point[] = [];
    for (const [x, y, z] of [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]) {
      const px = x * size[0] / 2, pz = z * size[2] / 2;
      points.push([center[0] + px * Math.cos(yaw) + pz * Math.sin(yaw), center[1] + y * size[1] / 2, center[2] - px * Math.sin(yaw) + pz * Math.cos(yaw)]);
    }
    for (const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]) this.quad(points[a], points[b], points[c], points[d], color);
  }
  beam(a: Point, b: Point, width: number, color: string) {
    const direction = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();
    const side = new THREE.Vector3().crossVectors(direction, Math.abs(direction.y) > .95 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0)).normalize().multiplyScalar(width/2);
    const up = new THREE.Vector3().crossVectors(direction, side).normalize().multiplyScalar(width/2);
    const points = [a,b].flatMap(p => [[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t]) => new THREE.Vector3(...p).addScaledVector(side,s).addScaledVector(up,t).toArray() as Point));
    for (const [i,j,k,l] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]) this.quad(points[i],points[j],points[k],points[l],color);
  }
  arc(def: StadiumDefinition, inner: number, outer: number, bottom: number, top: number, start: number, sweep: number, color: string, segments: number) {
    for (let i = 0; i < segments; i++) {
      const a = start + sweep * i / segments, b = start + sweep * (i + 1) / segments;
      const p = (r: number, angle: number, y: number) => footprintPoint(def, r, angle, y);
      const bi = p(inner,a,bottom), bo = p(outer,a,bottom), ci = p(inner,b,bottom), co = p(outer,b,bottom);
      const ti = p(inner,a,top), to = p(outer,a,top), ui = p(inner,b,top), uo = p(outer,b,top);
      // Modest baked cavity shading keeps stacked decks legible at every LOD.
      this.quad(ti,to,uo,ui,color); this.quad(bi,ci,co,bo,shaded(color,.55));
      this.quad(bi,ti,ui,ci,shaded(color,.78)); this.quad(bo,co,uo,to,shaded(color,.9));
      if (i === 0) this.quad(bi,bo,to,ti,color);
      if (i === segments - 1) this.quad(ci,ui,uo,co,color);
    }
  }
  mesh(material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    const uv:number[]=[];
    for(let i=0;i<this.positions.length;i+=3) uv.push((this.positions[i]+this.positions[i+2])*.18,(this.positions[i+1]+this.positions[i+2])*.18);
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    return new THREE.Mesh(geometry, material);
  }
}

function yawAt(def: StadiumDefinition, angle: number, radius=INNER) { return surfaceYaw(def,radius,angle); }
function span(def: StadiumDefinition, radius: number, a: number, b: number) {
  const p = footprintPoint(def, radius, a), q = footprintPoint(def, radius, b);
  return Math.hypot(p[0] - q[0], p[2] - q[2]);
}

interface Seat { point: Point; yaw: number; color: string; moduleId: number; padded?: boolean }
function seatMesh(seats: Seat[], back: boolean, material: THREE.Material, highDetail = false) {
  let geometry: THREE.BufferGeometry;
  if(back && highDetail) {
    const outline=new THREE.Shape();
    outline.moveTo(-.18,-.225); outline.lineTo(.18,-.225); outline.lineTo(.21,-.1);
    outline.lineTo(.21,.17); outline.lineTo(.16,.225); outline.lineTo(-.16,.225);
    outline.lineTo(-.21,.17); outline.lineTo(-.21,-.1); outline.closePath();
    geometry=new THREE.ExtrudeGeometry(outline,{depth:.075,bevelEnabled:false,steps:1});
    geometry.translate(0,0,-.0375); geometry.rotateX(-.1);
  } else geometry=new THREE.BoxGeometry(.42,back?.45:.12,back?.1:.4);
  const mesh = new THREE.InstancedMesh(geometry, material, seats.length);
  const object = new THREE.Object3D();
  const color = new THREE.Color();
  seats.forEach((seat, i) => {
    object.position.set(...seat.point); object.rotation.set(0, seat.yaw, 0);
    object.scale.set(seat.padded?1.12:1,seat.padded&&!back?1.5:1,seat.padded?1.1:1);
    if (back) object.position.add(new THREE.Vector3(Math.sin(seat.yaw) * .16, .24, Math.cos(seat.yaw) * .16));
    object.updateMatrix(); mesh.setMatrixAt(i, object.matrix); mesh.setColorAt(i, color.set(seat.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere(); mesh.computeBoundingBox();
  mesh.name = back ? 'Seat backs' : 'Seat bases';
  mesh.userData.moduleIds = seats.map(seat => seat.moduleId);
  return mesh;
}

export interface StadiumBuildOptions {
  map?: StadiumMap;
  currentDate?: string;
  selected?: readonly number[];
  activeModuleIds?: readonly number[];
  project?: ViewerProject | null;
  detail?: DetailLevel;
  night?: boolean;
  crowd?: boolean;
}
export interface StadiumBuild {
  setSelection: (ids: readonly number[]) => void;
  animate: (time: number) => void;
  group: THREE.Group;
  roofs: THREE.Object3D[];
  stats: { seats: number; meshes: number; triangles: number };
  dispose: () => void;
}

export function buildStadium(def: StadiumDefinition, savedModules: readonly ViewerModule[], options: StadiumBuildOptions = {}): StadiumBuild {
  const detail = options.detail ?? 'medium';
  // Geometry is neutral. Selection is a cheap material/instance-colour update.
  const selected = new Set<number>();
  const group = new THREE.Group(); group.name = def.name;
  const roofs: THREE.Object3D[] = [];
  const seats: Seat[] = [];
  const neutral = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .84, side: THREE.DoubleSide });
  const seatMaterial = new THREE.MeshStandardMaterial({ roughness: .65 });
  const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const ground = new Surface(), extras = new Surface(), glow = new Surface();
  const textures = new Set<THREE.Texture>();
  const displayMaterials: THREE.Material[] = [];
  const signs:Array<{position:Point;yaw:number;text:string}>=[];
  const glassMaterial=new THREE.MeshPhysicalMaterial({color:'#9dc4d4',roughness:.12,metalness:.25,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false});
  const metalMaterial=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.58,roughness:.36,side:THREE.DoubleSide});
  const brickMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,side:THREE.DoubleSide});
  const timeUniform={value:0};
  const crowdMaterial=seatMaterial.clone();
  crowdMaterial.onBeforeCompile=shader=>{
    shader.uniforms.stadiumTime=timeUniform;
    shader.vertexShader='uniform float stadiumTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed.x += sin(stadiumTime * 1.4 + instanceMatrix[3].x * 3.0 + instanceMatrix[3].z) * 0.025;\n#endif');
  };
  crowdMaterial.customProgramCacheKey=()=> 'stadium-crowd-sway-v1';
  displayMaterials.push(glassMaterial,metalMaterial,brickMaterial,crowdMaterial);
  const glowPixels=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++) for(let x=0;x<32;x++) {
    const r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5),alpha=Math.max(0,1-r);
    glowPixels.set([215,232,255,Math.round(alpha*alpha*95)],(y*32+x)*4);
  }
  const haloTexture=new THREE.DataTexture(glowPixels,32,32);haloTexture.needsUpdate=true;textures.add(haloTexture);
  const haloMaterial=new THREE.SpriteMaterial({map:haloTexture,color:new THREE.Color(3,3,3),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});displayMaterials.push(haloMaterial);
  const brickPixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++) for(let x=0;x<64;x++) {
    const mortar=y%16<2||(x+(Math.floor(y/16)%2)*16)%32<2;
    const value=mortar?190:120+(x*13+y*7)%35;
    brickPixels.set([value,mortar?183:value*.7,mortar?170:value*.54,255],(y*64+x)*4);
  }
  const bricks=new THREE.DataTexture(brickPixels,64,64); bricks.wrapS=bricks.wrapT=THREE.RepeatWrapping; bricks.colorSpace=THREE.SRGBColorSpace; bricks.needsUpdate=true;
  textures.add(bricks); brickMaterial.map=bricks; brickMaterial.bumpMap=bricks; brickMaterial.bumpScale=.045;
  if(detail==='high') {
    // Small deterministic mineral grain, generated locally and shared by all
    // concrete/ground surfaces. No downloaded texture licensing dependency.
    const data=new Uint8Array(64*64*4);
    for(let i=0;i<64*64;i++) {
      const v=160+((Math.imul(i+17,1103515245)>>>16)%80);
      data.set([v,v,v,255],i*4);
    }
    const grain=new THREE.DataTexture(data,64,64); grain.wrapS=grain.wrapT=THREE.RepeatWrapping;
    grain.needsUpdate=true; textures.add(grain); neutral.bumpMap=grain; neutral.bumpScale=.035;
    metalMaterial.bumpMap=grain;metalMaterial.bumpScale=.012;
  }
  const segments = detail === 'high' ? 18 : detail === 'medium' ? 10 : 5;
  const tiersOf = (entry: ViewerModule) => (STAND_DESIGNS[entry.templateId] ?? STAND_DESIGNS['standard-two']).tiers;
  const resolved = savedModules.map(entry => {
    const result=resolveVisualModule(entry, options.activeModuleIds ?? [], options.project);
    return result.active?result:{...result,entry:venueVisualModule(def,result.entry)};
  });
  const sectionDefs=sectionDefinitions(def,resolved.map(result=>result.entry));
  const sectionAt=(angle:number)=>sectionDefs[moduleIndexAt(angle,resolved.length)]??def;
  const rearAt=(angle:number)=>{
    const entry=resolved[moduleIndexAt(angle,resolved.length)]?.entry;
    return templateRear(sectionAt(angle),entry&&!entry.empty?tiersOf(entry):1);
  };
  let maxRear = INNER + def.rows * RUN, maxRoof = def.rows * RISE + 4;
  const addFloodlight=(position:Point)=>{
    if(!options.night) return;
    // Physical distance attenuation needs candela-scale output, not the old
    // decorative 1200 intensity which barely reached an 80m-away outfield.
    const light=new THREE.SpotLight('#e3edff',12000*Math.max(1,(Math.hypot(position[0],position[2])/85)**2),650,Math.PI/3,.48,2);
    light.position.set(...position); light.target.position.set(0,0,0);
    group.add(light,light.target);
    const halo=new THREE.Sprite(haloMaterial);halo.position.set(...position);halo.scale.set(9,9,1);halo.raycast=NO_RAYCAST;group.add(halo);
  };

  // One scene unit is one metre. Match simulation boundaries are unchanged.
  ground.arc(def,0,44,-.15,0,0,TAU,'#3d824e',144);
  ground.arc(def, 40.2, 40.32, .015, .06, 0, TAU, '#eee8d4', 144);
  ground.arc(def, 44, 46, -.15, -.025, 0, TAU, '#a9a491', 144);
  ground.box([0,.025,0], [8,.04,24], '#728754');
  ground.box([0,.055,0], [PITCH_WIDTH,.025,PITCH_LENGTH], '#cbb47d');
  for (const sign of [-1,1]) {
    const z=sign*PITCH_LENGTH/2;
    ground.box([0,.085,z], [2.64,.015,.075], '#f3efe1');
    ground.box([0,.085,z-sign*1.22], [3.66,.015,.075], '#f3efe1');
    for(const x of [-1.32,1.32]) ground.box([x,.085,z], [.075,.015,2.44], '#f3efe1');
    for (const x of [-.095,0,.095]) ground.box([x,.43,z], [.038,.711,.038], '#f3e6bf');
    ground.box([0,.8,z], [.229,.025,.035], '#f3e6bf');
  }
  const turfMaterial=neutral.clone();turfMaterial.roughness=1;displayMaterials.push(turfMaterial);
  turfMaterial.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 stadiumGroundPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstadiumGroundPosition=position;');
    shader.fragmentShader='varying vec3 stadiumGroundPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(abs(stadiumGroundPosition.y) < 0.01) diffuseColor.rgb *= 1.0 + 0.07 * step(0.5, fract(stadiumGroundPosition.x / 12.0));');
  };
  turfMaterial.customProgramCacheKey=()=> 'metric-stadium-turf-v1';
  const turfPixels=new Uint8Array(256*256*4);
  for(let y=0;y<256;y++) for(let x=0;x<256;x++) {
    const hash=(Math.imul(x+13,73856093)^Math.imul(y+47,19349663))>>>0;
    const v=185+(hash%64);turfPixels.set([v,v,v,255],(y*256+x)*4);
  }
  const turf=new THREE.DataTexture(turfPixels,256,256);turf.wrapS=turf.wrapT=THREE.RepeatWrapping;
  turf.generateMipmaps=true;turf.minFilter=THREE.LinearMipmapLinearFilter;turf.magFilter=THREE.LinearFilter;turf.anisotropy=4;turf.needsUpdate=true;
  textures.add(turf);turfMaterial.map=turf;turfMaterial.bumpMap=turf;turfMaterial.bumpScale=.025;
  const groundMesh = ground.mesh(turfMaterial); groundMesh.name = 'Ground'; groundMesh.raycast = NO_RAYCAST; group.add(groundMesh);
  const base=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshStandardMaterial({color:'#333c38',roughness:1}));
  base.rotation.x=-Math.PI/2;base.position.y=-.85;base.name='Site ground';base.raycast=NO_RAYCAST;group.add(base);

  resolved.forEach(({ entry, active }, index) => {
    const def=sectionDefs[index];
    const tierRadius = (tier: number) => INNER + tier * (def.rows * RUN + 1.1);
    const tierHeight = (tier: number) => 1 + tier * (def.rows * RISE + def.tierGap);
    const angle = moduleAngle(index,resolved.length);
    const step = TAU / Math.max(1, resolved.length);
    const mediaBay=def.screenAngles.some(a=>moduleIndexAt(a,resolved.length)===index);
    const previous = resolved[(index + 1) % resolved.length].entry;
    const next = resolved[(index + resolved.length - 1) % resolved.length].entry;
    const leftGap = previous.standName === entry.standName && !previous.empty ? .001 : .009;
    const rightGap = next.standName === entry.standName && !next.empty ? .001 : .009;
    const start = angle - step / 2 + leftGap, sweep = step - leftGap - rightGap;
    const body = new Surface(), roof = new Surface(), glazing = new Surface(), masonry = new Surface();
    let hasGlazing=false;
    const design = STAND_DESIGNS[entry.templateId] ?? STAND_DESIGNS['standard-two'];
    const targetTiers=tiersOf(entry);
    const progress=constructionProgress(options.project,options.currentDate);
    const changingStructure=active&&options.project?.action!=='refurbish';
    const demolished=changingStructure&&options.project?.phase==='demolition';
    const building=changingStructure&&options.project?.phase==='construction';
    const tiers=demolished?Math.max(1,Math.ceil(targetTiers*(1-progress))):building?Math.max(1,Math.ceil(targetTiers*progress)):targetTiers;
    const foundationOnly=(building&&progress<.16)||(demolished&&progress>.85);
    const concrete = active ? '#aa9270' : entry.condition < 60 ? '#8f8a7f' : entry.quality === 'Elite' ? '#e1dfd3' : def.concrete;
    const trim = selected.has(entry.id) ? '#ffe274' : def.fascia;
    const rear = tierRadius(tiers - 1) + def.rows * RUN;
    const roofY = tierHeight(tiers - 1) + def.rows * RISE + 3;
    if (!entry.empty) { maxRear = Math.max(maxRear, rear); maxRoof = Math.max(maxRoof, roofY); }
    if (entry.empty || foundationOnly) {
      body.arc(def, INNER, INNER + def.rows * RUN, -.05, .05, start, sweep, selected.has(entry.id) ? '#b29346' : '#817769', segments);
      if(active) {
        for(let footing=0;footing<5;footing++) {
          const a=start+sweep*(footing+.5)/5;
          body.box(footprintPoint(def,INNER+3,a,.2),[1.7,.4,3],'#67665c',yawAt(def,a));
          for(let rod=0;rod<3;rod++) body.box(footprintPoint(def,INNER+2+rod,a,.9),[.06,1.6,.06],'#716350');
        }
      }
    } else {
      for (let tier = 0; tier < tiers; tier++) {
        // Dedicated scoreboard bay above the lower seating, matching the
        // stand-integrated arrangement seen in match-day references.
        if(mediaBay&&tiers>1&&tier===tiers-1) continue;
        for (let row = 0; row < def.rows; row++) {
          const radius = tierRadius(tier) + row * RUN, height = tierHeight(tier) + row * RISE;
          const portalRow = !active && row >= 4 && row <= 9;
          if (portalRow) {
            // Cut an actual opening out of the seating deck, with the concourse
            // floor beneath it. No seats or solid risers across the entrance.
            for (const side of [0,1]) body.arc(def,radius,radius+RUN,tier===0?0:height-.65,height,side?angle+step*.045:start,sweep/2-step*.045,concrete,Math.ceil(segments/2));
            body.arc(def,radius,radius+RUN,tierHeight(tier)-.35,tierHeight(tier)-.2,angle-step*.045,step*.09,'#373d3d',2);
          } else body.arc(def, radius, radius + RUN, tier === 0 ? 0 : height - .65, height, start, sweep, concrete, segments);
          // Central circulation stair, left free by the instanced seat generator.
          if (!portalRow) body.arc(def, radius, radius + RUN, height, height + .015, angle - step * .04, step * .08, '#d3cbb4', 2);
          if(detail==='high'&&!active) {
            // Shared row mounting rails and bright stair nosings, not one draw
            // call per seat. Both stop at the circulation opening.
            for(const side of [0,1]) body.arc(def,radius+.38,radius+.44,height+.08,height+.16,side?angle+step*.06:start,sweep/2-step*.06,'#526267',Math.ceil(segments/2));
            if(!portalRow) body.arc(def,radius,radius+.075,height+.016,height+.022,angle-step*.038,step*.076,'#e8dcad',2);
          }
          if (detail==='high' && !active && !portalRow) {
            for (const sign of [-1,1]) {
              const a=angle+sign*step*.045;
              body.beam(footprintPoint(def,radius,a,height+.7),footprintPoint(def,radius+RUN,a,height+RISE+.7),.055,'#929fa1');
              if(row%2===0) body.box(footprintPoint(def,radius,a,height+.35),[.05,.7,.05],'#929fa1');
            }
          }
          if (!active && !(entry.templateId==='tensile-terrace'&&row<4)) {
            const seatRadius = radius + RUN * .53;
            const spacing = design.spacing * (detail === 'low' ? 1.9 : 1) * (entry.quality === 'Elite' ? 1.08 : 1);
            const total = Math.max(1, Math.floor(span(def, seatRadius, start, start + sweep) / spacing));
            for (let j = 0; j < total; j++) {
              const f = (j + .5) / total;
              if (f < .04 || f > .96 || Math.abs(f - .5) < .058) continue;
              const a = start + sweep * f;
              if(tier===0&&row<2&&f>.7&&f<.83) continue; // accessible viewing bay
              seats.push({ point: footprintPoint(def, seatRadius, a, height + .24), yaw: yawAt(def,a), moduleId: entry.id,padded:entry.quality==='Elite'||design.style==='premium'||design.style==='glass', color: selected.has(entry.id) ? '#ffcf57' : entry.condition < 60 ? '#99998d' : shaded(def.seats[(Math.floor(index / 3) + tier) % def.seats.length],.88+((j*13+row*7+index)%5)*.03) });
            }
          }
        }
        body.arc(def, tierRadius(tier) - .1, tierRadius(tier) + .13, tierHeight(tier), tierHeight(tier) + .7, start, sweep, trim, segments);
        const back = tierRadius(tier) + def.rows * RUN;
        body.arc(def, back, back + .5, 0, tierHeight(tier) + def.rows * RISE, start, sweep, concrete, segments);
        if (!active) {
          if(tier===0) {
            body.arc(def,tierRadius(tier),tierRadius(tier)+1.6,tierHeight(tier)-.2,tierHeight(tier),start+sweep*.7,sweep*.13,'#909d9f',3);
            body.arc(def,tierRadius(tier)-.05,tierRadius(tier)+.05,tierHeight(tier),tierHeight(tier)+.65,start+sweep*.7,sweep*.13,'#adc7cc',3);
          }
          const r=tierRadius(tier)+4*RUN, y=tierHeight(tier), yaw=yawAt(def,angle);
          const width=span(def,r,angle-step*.045,angle+step*.045);
          for (const sign of [-1,1]) body.arc(def,r,r+6*RUN,y-.2,y+3.3,angle+sign*step*.047-.002,.004,concrete,2);
          body.box(footprintPoint(def,r+5.6*RUN,angle,y+3),[width,.35,.6],concrete,yaw);
          body.box(footprintPoint(def,r+5.8*RUN,angle,y+1.3),[width,2.8,.12],'#152025',yaw);
          body.box(footprintPoint(def,r+5.5*RUN,angle,y+2.65),[Math.min(1,width*.7),.25,.12],'#39aa7f',yaw);
          signs.push({position:footprintPoint(def,r+5.35*RUN,angle,y+3.3),yaw:yaw+Math.PI,text:`EXIT ${entry.id+1}`});
          // Rear concourse: doors, crosswalk, refreshment hatch and an external
          // stair flight connect each tier visually to ground-level circulation.
          body.arc(def,back+.5,back+3,tierHeight(tier)-.25,tierHeight(tier),start,sweep,'#8e9694',segments);
          body.arc(def,back+2.9,back+3,tierHeight(tier)+.7,tierHeight(tier)+.8,start,sweep,'#829394',segments);
          if(detail==='high') {
            for(let post=0;post<10;post++) body.box(footprintPoint(def,back+2.95,start+sweep*(post+.5)/10,tierHeight(tier)+.4),[.05,.8,.05],'#71858a');
            glow.arc(def,back+.6,back+.67,tierHeight(tier)+2.55,tierHeight(tier)+2.6,start,sweep,options.night?'#ead6ae':'#ccc8bb',segments);
          }
          const a=start+sweep*.2, stairYaw=yawAt(def,a), stairHeight=tierHeight(tier);
          const steps=Math.ceil(stairHeight/.25);
          for(let s=0;s<steps;s++) {
            const flight=Math.floor(s/12), travel=(flight%2?11-s%12:s%12)*.24;
            const p=footprintPoint(def,back+3+(flight%2)*1.5,a,stairHeight-s*.25);
            p[0]+=Math.cos(stairYaw)*travel; p[2]-=Math.sin(stairYaw)*travel;
            body.box(p,[.28,.2,1.3],'#b0b4aa',stairYaw);
            if(s%12===11) body.box([p[0],p[1]-.2,p[2]],[.8,.2,3],'#b0b4aa',stairYaw);
          }
          if (detail==='high') for(let bay=0;bay<5;bay++) {
            const a=start+sweep*(bay+.5)/5;
            body.box(footprintPoint(def,back+.6,a,tierHeight(tier)+1.1),[1.5,2.2,.15],bay===2?'#67492f':'#243c43',yawAt(def,a));
            if(bay===2||bay===4) {
              signs.push({position:footprintPoint(def,back+.8,a,tierHeight(tier)+2.5),yaw:yawAt(def,a),text:bay===2?'FOOD':'WC'});
              if(bay===2) body.box(footprintPoint(def,back+1,a,tierHeight(tier)+.9),[1.8,.15,.7],'#b59a75',yawAt(def,a));
            }
          }
        }
      }
      body.arc(def, 45.5, 45.65, .04, .75, start, sweep, trim, segments);
      // Exterior bays and a coloured upper fascia break up the concrete shell.
      body.arc(def,rear+.51,rear+.68,roofY-3.7,roofY-3.05,start,sweep,def.fascia,segments);
      for (let bay=0; bay<4; bay++) {
        const a=start+sweep*(bay+.5)/4, yaw=yawAt(def,a);
        body.box(footprintPoint(def,rear+.72,a,(roofY-3)/2),[.24,roofY-3,.22],'#dddcd0',yaw);
        body.box(footprintPoint(def,rear+.69,a,1.5),[Math.max(1,span(def,rear,start,start+sweep)/6),2.7,.12],'#40525a',yaw);
      }
      // Suites honour explicit overrides, including zero; Eden's legacy rules
      // are never applied to another venue.
      const boxes = Math.max(0, Math.min(24, Math.floor(entry.hospitalityBoxes ?? (def.teamId === 'KKR' ? edenExistingBoxes(entry) : undefined) ?? design.boxes)));
      // Architectural facade belongs to its module: demolition and replacement
      // remove it with the stand. These are template details, not named replicas.
      if (!active && design.style !== 'plain') {
        const facade = entry.templateId==='victorian-pavilion'?'#b8846e':entry.templateId==='sandstone-arcade'?'#d6a876':design.style === 'heritage' ? '#d6bd94' : '#ccd4d4';
        const floors = Math.max(1, Math.floor((roofY-4)/3));
        if(entry.templateId==='victorian-pavilion') {
          for(let floor=0;floor<floors;floor++) masonry.arc(def,rear+.95,rear+1.06,floor*3,floor*3+.7,start,sweep,'#fff4df',segments);
        }
        for (let floor=0; floor<floors; floor++) {
          const y = 2.3 + floor*3;
          body.arc(def,rear+.7,rear+1,y-1,y+1,start,sweep,'#34596a',segments);
          body.arc(def,rear+.6,rear+2.2,y-1.25,y-1.02,start,sweep,facade,segments);
          body.arc(def,rear+2,rear+2.1,y-.9,y-.35,start,sweep,'#829b9f',segments);
          for (let bay=0; bay<6; bay++) {
            const a=start+sweep*(bay+.5)/6;
            body.box(footprintPoint(def,rear+1.05,a,y),[.15,2.4,.2],facade,yawAt(def,a));
          }
        }
        // Covered entrance and a glass door, kept inside the section's width.
        const width = span(def,rear,start,start+sweep)*.55;
        body.box(footprintPoint(def,rear+2,angle,3),[width,.22,3.2],facade,yawAt(def,angle));
        body.box(footprintPoint(def,rear+.85,angle,1.2),[width*.5,2.4,.1],'#203b48',yawAt(def,angle));
        const yaw=yawAt(def,angle);
        const local=(x:number,y:number,z:number):Point=>{
          const p=footprintPoint(def,rear+2,angle,y);
          return [p[0]+Math.cos(yaw)*x+Math.sin(yaw)*z,y,p[2]-Math.sin(yaw)*x+Math.cos(yaw)*z];
        };
        if (design.style==='heritage') {
          // Colonnade, capitals, cornice and triangular pediment.
          const stone='#dfd1ad';
          for(let c=0;c<6;c++) {
            const x=(c/5-.5)*width;
            body.box(local(x,2.3,1),[.32,4.6,.32],stone,yaw);
            for(const y of [.2,4.45]) body.box(local(x,y,1),[.65,.3,.65],stone,yaw);
          }
          body.box(local(0,4.8,1),[width+1,.4,1.5],stone,yaw);
          body.triangle(local(-width*.55,5,1.8),local(width*.55,5,1.8),local(0,7,1.8),stone);
          for(let d=0;d<14;d++) body.box(local((d/13-.5)*width,4.52,1.7),[.16,.2,.18],'#af956c',yaw);
          if(entry.templateId==='classical-pavilion') {
            body.box(local(0,roofY-.5,0),[3,3.5,3],stone,yaw);
            for(let f=0;f<12;f++) {
              const a=f/12*TAU,b=(f+1)/12*TAU;
              roof.triangle(local(Math.sin(a)*2,roofY+1.3,Math.cos(a)*2),local(Math.sin(b)*2,roofY+1.3,Math.cos(b)*2),local(0,roofY+3.5,0),'#687f77');
            }
          }
          if(entry.templateId==='sandstone-arcade') {
            for(let arch=0;arch<4;arch++) {
              const x=(arch/3-.5)*width*.85;
              for(let s=0;s<12;s++) {
                const a=s/12*Math.PI,b=(s+1)/12*Math.PI;
                body.beam(local(x+Math.cos(a)*.9,3.5+Math.sin(a)*.9,1.9),local(x+Math.cos(b)*.9,3.5+Math.sin(b)*.9,1.9),.22,'#b18559');
              }
            }
          }
          if(entry.templateId==='victorian-pavilion') {
            body.box(local(0,roofY,0),[3.2,4,3],'#c29474',yaw);
            body.box(local(0,roofY+.2,1.55),[1.9,1.9,.12],'#f1e6c9',yaw);
            body.beam(local(0,roofY+.2,1.65),local(0,roofY+.85,1.65),.08,'#252c2d');
            body.beam(local(0,roofY+.2,1.65),local(.55,roofY+.2,1.65),.08,'#252c2d');
            roof.triangle(local(-2,roofY+2,1.7),local(2,roofY+2,1.7),local(0,roofY+4,1.7),'#4b6461');
          }
        } else if(entry.templateId==='art-deco-pavilion') {
          for(let band=0;band<3;band++) body.box(local(0,roofY-2+band*.7,1),[width*(1-band*.2),.65,2.5],'#d7c59f',yaw);
          for(let fin=0;fin<7;fin++) body.box(local((fin/6-.5)*width,roofY*.5,1.25),[.2,roofY-3,.5],'#ae935e',yaw);
        } else if(entry.templateId==='garden-pavilion') {
          for(let planter=0;planter<5;planter++) {
            const x=(planter/4-.5)*width;
            body.box(local(x,3.4,1),[1.1,.5,.9],'#a27d59',yaw);
            body.box(local(x,3.8,1),[1,.45,.8],'#477c4f',yaw);
          }
          for(let slat=0;slat<12;slat++) roof.box(local((slat/11-.5)*width,roofY+.3,0),[.16,.2,4],'#977853',yaw);
        } else if(entry.templateId==='glass-sky-lounge') {
          for(const y of [roofY-3,roofY-.3]) body.box(local(0,y,1.8),[width+1,.2,4],'#d1d8d7',yaw);
          glazing.box(local(0,roofY-1.6,3.7),[width+1,2.5,.05],'#ffffff',yaw);hasGlazing=true;
          for(const sign of [-1,1]) {
            glazing.box(local(sign*(width+1)/2,roofY-1.6,1.8),[.05,2.5,4],'#ffffff',yaw);
            body.box(local(sign*width*.28,roofY-2.4,1.8),[1,.12,1],'#b09a72',yaw);
          }
          glow.box(local(0,roofY-.48,2),[width,.04,.12],'#e9c98a',yaw);
        } else if(design.style==='media') {
          body.box(local(0,roofY-2.5,0),[width,2,2],'#264856',yaw);
          for(const x of [-width*.3,width*.3]) body.box(local(x,roofY-.9,-.5),[.7,.5,1],'#1c262b',yaw);
        }
      }
      if (!active && boxes) for (let box = 0; box < boxes; box++) {
        hasGlazing=true;
        const a = start + sweep * (.06 + .88 * (box + .5) / boxes), yaw = yawAt(def,a);
        const radius = tierRadius(Math.min(1,tiers - 1)) - .75;
        const y = tierHeight(Math.min(1,tiers - 1)) - .4;
        const width = span(def,radius,start,start+sweep) * .85 / boxes;
        const roomColor=design.style==='heritage'?'#bb9b76':'#e0dfd5';
        for(const floor of [-.78,.78]) body.box(footprintPoint(def,radius,a,y+floor),[width,.14,1.8],roomColor,yaw);
        body.box(footprintPoint(def,radius+.78,a,y),[width,1.6,.12],'#5b5142',yaw);
        glazing.box(footprintPoint(def,radius-.83,a,y+.02),[width*.92,1.4,.04],'#ffffff',yaw);
        body.box(footprintPoint(def,radius,a,y-.25),[width*.38,.08,.55],'#bca074',yaw);
        for(const sign of [-1,1]) {
          const p=footprintPoint(def,radius,a,y-.4); p[0]+=Math.cos(yaw)*width*.29*sign; p[2]-=Math.sin(yaw)*width*.29*sign;
          body.box(p,[Math.min(.38,width*.17),.12,.4],'#735440',yaw);
        }
        glow.box(footprintPoint(def,radius+.5,a,y+.64),[width*.7,.06,.1],options.night?'#f4cf83':'#ccc4ac',yaw);
        if (design.style === 'heritage') for (const sign of [-1,1]) {
          const p = footprintPoint(def,radius-.72,a,y);
          p[0] += Math.cos(yaw) * width * .43 * sign; p[2] -= Math.sin(yaw) * width * .43 * sign;
          body.box(p,[.13,1.85,.18],'#ead8b4',yaw);
        }
      }
      if (active) {
        for (let i = 0; i < 5; i++) {
          const a = start + sweep * (i + .5) / 5, yaw = yawAt(def,a);
          body.box(footprintPoint(def,rear-3,a,roofY/2),[.12,roofY,.12],'#a8afb0',yaw);
          for (let y = 3; y < roofY; y += 3) body.box(footprintPoint(def,rear-3,a,y),[span(def,rear,start,start+sweep)/5,.1,.16],'#c3b17a',yaw);
        }
      } else if (entry.roof !== 'None' && !mediaBay) {
        // Architect PK Das records a 25m Wankhede cantilever. Use metres, not
        // template units; retain the user's partial-canopy/novel upgrade choice.
        const roofMetres=def.teamId==='MI'&&entry.roof!=='Partial canopy'&&design.style!=='heritage'?25:undefined;
        const depth = roofMetres?rear-templateRadiusForMetres(def,metricRadius(def,rear,angle)-roofMetres,angle):entry.templateId==='asymmetric-grandstand'?Math.min(20,def.rows*RUN+5):entry.roof === 'Partial canopy' ? 4 : entry.roof === 'Cantilever' ? Math.min(16, def.rows * RUN + 2) : 10;
        const sculpted=entry.templateId==='tensile-terrace'||entry.templateId==='asymmetric-grandstand'||def.roofProfile!=='flat'||entry.roof==='Cantilever'||entry.roof==='Landmark roof';
        const panels = entry.roof === 'Landmark roof' || def.roofProfile !== 'flat' ? 6 : 1;
        if(sculpted) {
          const cuts=detail==='high'?24:12;
          const p=(u:number,v:number):Point=>{
            const lift=entry.templateId==='tensile-terrace'?2.6*Math.cos(u*Math.PI*4)*(v-.5):entry.templateId==='asymmetric-grandstand'?u*3+v*v*1.4:Math.sin(u*Math.PI)*(def.roofProfile==='petal'?1.8:.8)+Math.pow(v-.4,2)*1.2;
            return footprintPoint(def,rear-depth+v*(depth+1.6),start+sweep*u,roofY+lift);
          };
          for(let u=0;u<cuts;u++) for(let v=0;v<5;v++) roof.quad(p(u/cuts,v/5),p((u+1)/cuts,v/5),p((u+1)/cuts,(v+1)/5),p(u/cuts,(v+1)/5),def.roofColor);
          for(let rib=0;rib<=6;rib++) roof.beam(p(rib/6,0),p(rib/6,1),.09,'#8a999c');
        } else for (let panel = 0; panel < panels; panel++) {
          const t = (panel + .5) / panels;
          const lift = def.roofProfile === 'petal' || entry.roof === 'Landmark roof' ? Math.sin(t*Math.PI)*1.45 : def.roofProfile === 'wave' ? Math.sin(t*Math.PI)*.7 : 0;
          roof.arc(def,rear-depth,rear+1.6,roofY+lift,roofY+lift+.22,start+sweep*panel/panels,sweep/panels,def.roofColor,Math.max(2,Math.ceil(segments/panels)));
        }
        roof.arc(def,rear+1.4,rear+1.7,roofY-.2,roofY+.1,start,sweep,'#73868b',segments);
        for(const a of [start+sweep*.06,start+sweep*.94]) body.box(footprintPoint(def,rear+1.6,a,roofY/2),[.12,roofY,.12],'#829293',yawAt(def,a));
        for (let j = 0; j < 3; j++) {
          const a = start+sweep*(j+.5)/3, yaw = yawAt(def,a);
          body.box(footprintPoint(def,rear,a,roofY/2),[.3,roofY,.4],'#b4bdc0',yaw);
          roof.beam(footprintPoint(def,rear-depth,a,roofY-.3),footprintPoint(def,rear+1.6,a,roofY-.3),.24,'#849296');
          if(detail==='high') {
            for(let truss=0;truss<6;truss++) {
              const r=rear-depth+(depth/6)*truss;
              roof.beam(footprintPoint(def,r,a,roofY-.2),footprintPoint(def,r+depth/6,a,roofY-1.1),.09,'#83949b');
              roof.beam(footprintPoint(def,r,a,roofY-1.1),footprintPoint(def,r+depth/6,a,roofY-.2),.09,'#83949b');
            }
            roof.beam(footprintPoint(def,rear-depth,a,roofY-1.1),footprintPoint(def,rear,a,roofY-1.1),.12,'#83949b');
          }
        }
        if (def.lights === 'ring') {
          glow.arc(def,rear-depth,rear-depth+.45,roofY-.45,roofY-.1,start,sweep,options.night ? '#fff3c7' : '#d9d9c6',segments);
          if(index%6===0) addFloodlight(footprintPoint(def,rear-depth,angle,roofY-.5));
        }
      }
    }
    if(active) {
      body.arc(def,INNER-1,INNER-.8,0,1.5,start,sweep,'#bc944d',segments);
      const p=footprintPoint(def,rear+4,angle),height=roofY+9;
      if(entry.id===(options.activeModuleIds??[])[0]&&options.project?.action!=='refurbish') {
        body.box([p[0],height/2,p[2]],[.55,height,.55],'#d2ad48');
        body.beam([p[0]-7,height,p[2]],[p[0]+12,height,p[2]],.3,'#d2ad48');
        body.beam([p[0],height+3,p[2]],[p[0]+12,height,p[2]],.1,'#d2ad48');
        body.beam([p[0]+10,height,p[2]],[p[0]+10,height-6,p[2]],.04,'#444d50');
        body.box([p[0]-6,height-.4,p[2]],[2,1.2,1.5],'#777d77');
      }
      for(let stack=0;stack<3;stack++) body.box(footprintPoint(def,rear+3,angle+(stack-1)*.035,.4),[1.2,.8,1.4],demolished?'#9b8c74':'#bac0b4');
    }
    const mesh = body.mesh(neutral); mesh.name = entry.standName; mesh.userData.moduleId = entry.id; group.add(mesh);
    if(!entry.empty&&!active&&entry.templateId==='victorian-pavilion') {
      const brickwork=masonry.mesh(brickMaterial);brickwork.name=`Brick facade ${entry.id}`;brickwork.userData.moduleId=entry.id;group.add(brickwork);
    }
    if(hasGlazing) {
      const windows=glazing.mesh(glassMaterial); windows.name=`Hospitality glass ${entry.id}`; windows.userData.moduleId=entry.id; group.add(windows);
    }
    if (!entry.empty && !active && entry.roof !== 'None' && !mediaBay) {
      const mesh = roof.mesh(entry.templateId==='tensile-terrace'?neutral:metalMaterial); mesh.name = `Roof ${entry.id}`; mesh.userData.moduleId = entry.id; roofs.push(mesh); group.add(mesh);
    }
  });
  if (seats.length) {
    group.add(seatMesh(seats,false,seatMaterial));
    if (detail !== 'low') group.add(seatMesh(seats,true,seatMaterial,detail==='high'));
  }
  if (options.crowd && seats.length) {
    // Deterministic exhibition crowd, not attendance or supporter state.
    const spectators=seats.filter((_,i)=>((Math.floor(i/5)*137+29)%100)<42);
    for(const head of [false,true]) {
      const crowd=new THREE.InstancedMesh(head?new THREE.SphereGeometry(.13,6,4):new THREE.BoxGeometry(.32,.43,.22),crowdMaterial,spectators.length);
      const object=new THREE.Object3D(), color=new THREE.Color();
      spectators.forEach((seat,i)=>{
        object.position.set(seat.point[0],seat.point[1]+(head?.68:.35),seat.point[2]); object.rotation.y=seat.yaw; object.updateMatrix();
        object.rotation.z=(i%5-2)*.025; object.scale.setScalar(.9+(i%4)*.045); object.updateMatrix();
        crowd.setMatrixAt(i,object.matrix);
        crowd.setColorAt(i,color.set(head?['#c28e68','#966648','#d8b08a'][i%3]:i%4===0?['#d6d5c6','#653e35','#374458','#e0b354'][i%7%4]:def.seats[i%def.seats.length]));
      });
      crowd.userData.moduleIds=spectators.map(seat=>seat.moduleId);
      crowd.instanceMatrix.needsUpdate=true; if(crowd.instanceColor) crowd.instanceColor.needsUpdate=true;
      crowd.computeBoundingSphere(); crowd.name=head?'Spectator heads':'Spectator bodies'; group.add(crowd);
    }
    spectators.forEach((seat,i)=>{
      if(i%7!==0) return;
      const y=seat.point[1]+.46;
      for(const side of [-1,1]) {
        const x=seat.point[0]+Math.cos(seat.yaw)*side*.2,z=seat.point[2]-Math.sin(seat.yaw)*side*.2;
        extras.beam([x,y,z],[x+Math.cos(seat.yaw)*side*.12,y+(i%3===0?.35:-.18),z],.07,def.seats[i%def.seats.length]);
      }
    });
  }

  // Sight screens and shelters sit outside the rope, leaving the field clear.
  for(const angle of [0,Math.PI]) {
    const p=footprintPoint(def,43,angle),yaw=yawAt(def,angle);
    extras.box([p[0],2.25,p[2]],[8,4,.24],'#d3d5ce',yaw);
    for(let slat=0;slat<20;slat++) extras.box([p[0]+Math.cos(yaw)*(slat-9.5)*.37,2.25,p[2]-Math.sin(yaw)*(slat-9.5)*.37],[.3,3.8,.3],'#e3e4d9',yaw);
    extras.box([p[0],.22,p[2]],[9,.25,1.5],'#65716e',yaw);
  }
  for(const angle of [Math.PI*.42,Math.PI*.58]) {
    const p=footprintPoint(def,44.5,angle),yaw=yawAt(def,angle);
    extras.box([p[0],2.4,p[2]],[6,.16,1.8],def.fascia,yaw);
    for(const side of [-1,1]) extras.box([p[0]+Math.cos(yaw)*side*2.8,1.2,p[2]-Math.sin(yaw)*side*2.8],[.1,2.4,1.8],'#788e95',yaw);
    for(let seat=0;seat<7;seat++) extras.box([p[0]+Math.cos(yaw)*(seat-3)*.72,.65,p[2]-Math.sin(yaw)*(seat-3)*.72],[.55,.16,.55],def.seats[0],yaw);
  }
  for(let panel=0;panel<64;panel++) {
    const angle=panel/64*TAU;
    if(Math.abs(Math.sin(angle))<.15) continue;
    glow.arc(def,41.5,41.58,.1,.85,angle,.085,panel%3===0?'#d3cba6':def.fascia,2);
  }

  extras.arc(def,44,templateRear(def,2)+15,-.55,-.2,0,TAU,'#aaa99d',144);
  // Match-day fit-out is decorative, not a claim of surveyed stall positions.
  // Keep the playing boundary clear; fencing encloses the spectator side.
  for(let sector=0;sector<8;sector++) {
    const def=sectionAt(sector/8*TAU),maxRear=rearAt(sector/8*TAU);
    const start=sector/8*TAU+.032,sweep=TAU/8-.064;
    for(const y of [.35,1.05,1.72]) extras.arc(def,45.85,45.9,y,y+.045,start,sweep,'#617277',36);
    for(let post=0;post<34;post++) {
      const a=start+sweep*post/33;
      extras.box(footprintPoint(def,45.88,a,.86),[post%5===0?.065:.026,1.72,.055],'#6e8083',yawAt(def,a));
    }
    const gate=sector/8*TAU,gateYaw=yawAt(def,gate),r=maxRear+6;
    // Entrance arches and queue lanes remain within the model's apron.
    for(const side of [-1,1]) extras.box(footprintPoint(def,r,gate+side*.022,1.5),[.3,3,.3],'#5f747b');
    extras.box(footprintPoint(def,r,gate,3),[4,.55,.5],def.fascia,gateYaw);
    signs.push({position:footprintPoint(def,r+.31,gate,3.08),yaw:gateYaw,text:`GATE ${sector+1}`});
    for(let lane=0;lane<3;lane++) {
      const a=gate+(lane-1)*.014;
      const p=footprintPoint(def,r+2,a,.95),q=footprintPoint(def,r+4,a,.95);
      extras.beam(p,q,.06,'#d3ae51');
      for(const point of [p,q]) extras.box([point[0],.48,point[2]],[.06,.95,.06],'#b29657');
    }
    for(let kiosk=0;kiosk<3;kiosk++) {
      const a=gate+.085+kiosk*.072,yaw=yawAt(def,a),p=footprintPoint(def,maxRear+6,a);
      const local=(x:number,y:number,z:number):Point=>[p[0]+Math.cos(yaw)*x+Math.sin(yaw)*z,y,p[2]-Math.sin(yaw)*x+Math.cos(yaw)*z];
      extras.box(local(0,1.2,0),[3.4,2.4,2.1],kiosk===1?'#b39a71':'#667b7e',yaw);
      extras.box(local(0,1.4,1.07),[2.7,1,.08],'#1c2b31',yaw);
      extras.box(local(0,.94,1.35),[3,.12,.65],'#c0b99e',yaw);
      extras.box(local(0,2.58,.25),[3.8,.18,2.9],def.fascia,yaw);
      for(let stripe=0;stripe<8;stripe++) extras.box(local((stripe-3.5)*.46,2.68,.25),[.2,.025,2.9],'#c8c7b9',yaw);
      glow.box(local(0,2.22,1.09),[2.8,.08,.05],'#e7cd98',yaw);
      signs.push({position:local(0,2.55,1.76),yaw,text:['FOOD','DRINKS','CLUB SHOP'][kiosk]});
      for(let bin=0;bin<2;bin++) extras.box(local(2.2, .48,bin*.65-.3),[.5,.96,.5],bin?'#627c56':'#487184',yaw);
    }
    for(let bench=0;bench<2;bench++) {
      const a=gate-.09-bench*.055,yaw=yawAt(def,a),p=footprintPoint(def,maxRear+7,a);
      extras.box([p[0],.48,p[2]],[2.5,.12,.55],'#8e7758',yaw);
      for(const side of [-1,1]) extras.box([p[0]+Math.cos(yaw)*side*.9,.22,p[2]-Math.sin(yaw)*side*.9],[.12,.44,.45],'#586c70',yaw);
    }
  }

  // Geographic context stays fixed when the editable bowl changes.
  if(options.map) group.add(buildMappedSurroundings(options.map));

  // Freestanding lights live outside the largest upgraded tier, not inside it.
  for (let light = 0; light < def.mastCount; light++) {
    const angle = TAU * (light + .5) / def.mastCount;
    const section=sectionAt(angle);
    const height = Math.max(def.mastHeight, maxRoof + 10), radius = rearAt(angle) + 4;
    const p = footprintPoint(section,radius,angle), yaw = yawAt(section,angle,radius);
    addFloodlight([p[0],height,p[2]]);
    extras.box([p[0],.3,p[2]],[3.4,.6,3.4],'#929a91');
    extras.box([p[0],height/2,p[2]],[.65,height,.65],'#acb5b8');
    for (const side of [-1,1]) {
      const x=p[0]+side*1.1;
      extras.beam([x,0,p[2]],[x,height,p[2]],.18,'#a2afb6');
      for (let level=0; level<height-4; level+=4) {
        extras.beam([p[0]-side*1.1,level,p[2]],[p[0]+side*1.1,Math.min(level+4,height),p[2]],.1,'#83969d');
      }
    }
    extras.box([p[0],height-2.1,p[2]],[8,.18,2.2],'#62757e',yaw);
    extras.box([p[0],height-1.5,p[2]],[8,.12,.12],'#a2afb6',yaw);
    // Aim the physical lamp bank at the pitch as well as the light source.
    const inward=new THREE.Vector3(-p[0],-height,-p[2]).normalize();
    const horizontal=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    const vertical=new THREE.Vector3().crossVectors(horizontal,inward).normalize();
    const lampPoint=(x:number,y:number,depth:number):Point=>new THREE.Vector3(p[0],height,p[2]).addScaledVector(horizontal,x).addScaledVector(vertical,y).addScaledVector(inward,depth).toArray() as Point;
    extras.quad(lampPoint(-4,-2,-.15),lampPoint(4,-2,-.15),lampPoint(4,2,-.15),lampPoint(-4,2,-.15),'#61747c');
    for(const side of [-1,1]) extras.beam([p[0],height-2,p[2]],lampPoint(side*3.5,-1.7,0),.2,'#80939a');
    for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) {
      const dx = (col-3.5)*.8;
      const cy=(row-1)*1.05;
      glow.quad(lampPoint(dx-.3,cy-.35,.04),lampPoint(dx+.3,cy-.35,.04),lampPoint(dx+.3,cy+.35,.04),lampPoint(dx-.3,cy+.35,.04),options.night?'#fff4dc':'#d1d9d9');
    }
  }
  // Static LED artwork: real venue identity, no invented live match scores.
  let screenMaterial: THREE.MeshBasicMaterial | null = null;
  if (typeof document !== 'undefined') {
    const canvas=document.createElement('canvas'); canvas.width=1536; canvas.height=864;
    const ctx=canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle='#091a29'; ctx.fillRect(0,0,1536,864);
      ctx.fillStyle=def.fascia; ctx.fillRect(0,0,1536,138);
      ctx.fillStyle='#f4eed8'; ctx.font='bold 60px sans-serif'; ctx.textAlign='center';
      ctx.fillText('WELCOME TO OUR HOME',768,94);
      ctx.font='bold 160px sans-serif'; ctx.fillText(def.teamId,768,380);
      ctx.font='bold 65px sans-serif'; ctx.fillText(def.name.toUpperCase(),768,510,1410);
      ctx.fillStyle=def.seats[0]; ctx.fillRect(115,584,1306,7);
      ctx.fillStyle='#e5edf3'; ctx.font='38px sans-serif'; ctx.fillText('STADIUM VIEWER',768,710);
      ctx.fillStyle='rgba(0,0,0,.12)'; for(let y=0;y<864;y+=4) ctx.fillRect(0,y,1536,1);
      const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; textures.add(texture);
      texture.anisotropy=4;
      screenMaterial=new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide,toneMapped:false});
      displayMaterials.push(screenMaterial);
    }
  }
  for (const requestedAngle of def.screenAngles) {
    const screenIndex=moduleIndexAt(requestedAngle,resolved.length);
    const angle=moduleAngle(screenIndex,resolved.length);
    const def=sectionAt(angle);
    const tierRadius = (tier: number) => INNER + tier * (def.rows * RUN + 1.1);
    const tierHeight = (tier: number) => 1 + tier * (def.rows * RISE + def.tierGap);
    const screenEntry=resolved[screenIndex]?.entry;
    if(!screenEntry||screenEntry.empty) continue;
    const screenTiers=screenEntry&&!screenEntry.empty?tiersOf(screenEntry):1;
    const radius=tierRadius(screenTiers-1)+def.rows*RUN+.3,yaw=yawAt(def,angle);
    const baseY=Math.max(5,tierHeight(screenTiers-1)-.6),y=baseY+4.3;
    // A structural service/scoreboard tower in a roof-free upper-stand bay.
    extras.box(footprintPoint(def,radius+.5,angle,baseY/2),[13.8,baseY,1.6],'#46555c',yaw);
    extras.box(footprintPoint(def,radius,angle,y),[15.2,8.6,.75],'#202a30',yaw);
    const screenPoint=footprintPoint(def,radius,angle,y);
    for (const offset of [-5.8,5.8]) {
      const x=screenPoint[0]+Math.cos(yaw)*offset,z=screenPoint[2]-Math.sin(yaw)*offset;
      extras.box([x,y/2,z],[.65,y,.8],'#81939a',yaw);
      extras.box([x,.18,z],[1.5,.36,1.5],'#969b91',yaw);
      extras.beam([x,1,z],[x+Math.sin(yaw)*1.7,baseY,z+Math.cos(yaw)*1.7],.18,'#71838b');
    }
    extras.box(footprintPoint(def,radius,angle,baseY-.15),[15.4,.3,1.6],'#4b5e65',yaw);
    if (screenMaterial) {
      const screen=new THREE.Mesh(new THREE.PlaneGeometry(14.6,8.2125),screenMaterial);
      screen.position.set(screenPoint[0]-Math.sin(yaw)*.43,y,screenPoint[2]-Math.cos(yaw)*.43);
      screen.rotation.y=yaw+Math.PI;
      screen.name='LED venue screen'; screen.raycast=NO_RAYCAST; group.add(screen);
      screen.userData.inBowl=true;
    }
    glow.box(footprintPoint(def,radius-.35,angle,y),[14.6,8.2,.05],'#0b2837',yaw);
    if (!screenMaterial) for (let row = 0; row < 3; row++) glow.box(footprintPoint(def,radius-.68,angle,y+1.3-row*1.3),[row===0 ? 8 : 6,.3,.08],def.seats[row%def.seats.length],yaw);
  }
  const extraMesh = extras.mesh(neutral); extraMesh.raycast = NO_RAYCAST; group.add(extraMesh);
  if(typeof document!=='undefined'&&signs.length) {
    const labels=Array.from(new Set(signs.map(sign=>sign.text)));
    const columns=4,rows=Math.ceil(labels.length/columns),canvas=document.createElement('canvas');
    canvas.width=1024;canvas.height=rows*64;
    const ctx=canvas.getContext('2d');
    if(ctx) {
      ctx.fillStyle='#153d35';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f1eedb';ctx.font='bold 30px sans-serif';ctx.textAlign='center';
      labels.forEach((label,i)=>ctx.fillText(label,(i%columns)*256+128,Math.floor(i/columns)*64+43,240));
      const atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;textures.add(atlas);
      const material=new THREE.MeshBasicMaterial({map:atlas,side:THREE.DoubleSide});displayMaterials.push(material);
      const positions:number[]=[],uv:number[]=[];
      signs.forEach(sign=>{
        const i=labels.indexOf(sign.text),left=(i%columns)/columns,right=left+1/columns,top=1-Math.floor(i/columns)/rows,bottom=top-1/rows;
        const points=[[-1,-.25],[1,-.25],[1,.25],[-1,.25]];
        const coords=[[left,bottom],[right,bottom],[right,top],[left,top]];
        for(const index of [0,1,2,0,2,3]) {
          const [x,y]=points[index];positions.push(sign.position[0]+Math.cos(sign.yaw)*x,sign.position[1]+y,sign.position[2]-Math.sin(sign.yaw)*x);uv.push(...coords[index]);
        }
      });
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,material);mesh.name='Concourse wayfinding';mesh.raycast=NO_RAYCAST;group.add(mesh);
    }
  }
  const glowMesh = glow.mesh(glowMaterial); glowMesh.raycast = NO_RAYCAST; group.add(glowMesh);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>([neutral,seatMaterial,glowMaterial,...displayMaterials]);
  const stats = { seats: seats.length, meshes: 0, triangles: 0 };
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry); stats.meshes++;
    (Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));
    object.receiveShadow=true;
    object.castShadow=object.name !== 'Ground' && object.name !== 'Site ground' && object.name !== 'LED venue screen' && !(object instanceof THREE.InstancedMesh);
    const triangles = (object.geometry.index?.count ?? object.geometry.getAttribute('position').count)/3;
    stats.triangles += triangles * (object instanceof THREE.InstancedMesh ? object.count : 1);
  });
  let disposed = false;
  const originalMaterials=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>();
  const highlights=new Map<THREE.Material,THREE.Material>();
  const seatInstances:THREE.InstancedMesh[]=[];
  group.traverse(object=>{
    if(object instanceof THREE.Mesh && typeof object.userData.moduleId==='number') originalMaterials.set(object,object.material);
    if(object instanceof THREE.InstancedMesh && (object.name==='Seat bases'||object.name==='Seat backs')) seatInstances.push(object);
  });
  const highlight=(material:THREE.Material)=>{
    let tinted=highlights.get(material);
    if(!tinted) {
      tinted=material.clone();
      if(tinted instanceof THREE.MeshStandardMaterial) {tinted.emissive.set('#b98120');tinted.emissiveIntensity=.38;}
      highlights.set(material,tinted);materials.add(tinted);
    }
    return tinted;
  };
  const selectionColor=new THREE.Color(),selectionKey={value:''};
  const setSelection=(ids:readonly number[])=>{
    const key=Array.from(new Set(ids)).sort((a,b)=>a-b).join(',');
    if(disposed||key===selectionKey.value) return;
    selectionKey.value=key;const chosen=new Set(ids);
    originalMaterials.forEach((original,mesh)=>{
      mesh.material=chosen.has(mesh.userData.moduleId)?Array.isArray(original)?original.map(highlight):highlight(original):original;
    });
    seatInstances.forEach(mesh=>{
      seats.forEach((seat,i)=>mesh.setColorAt(i,selectionColor.set(chosen.has(seat.moduleId)?'#ffcf57':seat.color)));
      if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
    });
  };
  setSelection(options.selected??[]);
  return { group, roofs, stats, setSelection, animate(time:number) {timeUniform.value=Number.isFinite(time)?time:0;}, dispose() {
    if (disposed) return;
    disposed = true;
    group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
  } };
}
