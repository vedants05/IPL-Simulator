import * as THREE from 'three';
import { STAND_DESIGNS, edenExistingBoxes } from '../stadiumVisualDesigns';
import type { StadiumDefinition } from './definitions';
import { resolveVisualModule, type DetailLevel, type ViewerModule, type ViewerProject } from './types';

type Point = [number, number, number];
const TAU = Math.PI * 2;
const RUN = .8;
const RISE = .43;
const INNER = 47;
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
  arc(def: StadiumDefinition, inner: number, outer: number, bottom: number, top: number, start: number, sweep: number, color: string, segments: number) {
    for (let i = 0; i < segments; i++) {
      const a = start + sweep * i / segments, b = start + sweep * (i + 1) / segments;
      const p = (r: number, angle: number, y: number) => footprintPoint(def, r, angle, y);
      const bi = p(inner,a,bottom), bo = p(outer,a,bottom), ci = p(inner,b,bottom), co = p(outer,b,bottom);
      const ti = p(inner,a,top), to = p(outer,a,top), ui = p(inner,b,top), uo = p(outer,b,top);
      this.quad(ti,to,uo,ui,color); this.quad(bi,ci,co,bo,color);
      this.quad(bi,ti,ui,ci,color); this.quad(bo,co,uo,to,color);
      if (i === 0) this.quad(bi,bo,to,ti,color);
      if (i === segments - 1) this.quad(ci,ui,uo,co,color);
    }
  }
  mesh(material: THREE.Material): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    return new THREE.Mesh(geometry, material);
  }
}

export function footprintPoint(def: StadiumDefinition, radius: number, angle: number, y = 0): Point {
  const s = Math.sin(angle), c = Math.cos(angle), power = 2 / def.footprint.exponent;
  return [Math.sign(s) * Math.pow(Math.abs(s), power) * radius * def.footprint.x, y, Math.sign(c) * Math.pow(Math.abs(c), power) * radius * def.footprint.z];
}
function yawAt(def: StadiumDefinition, angle: number) {
  const a = footprintPoint(def, 1, angle - .001), b = footprintPoint(def, 1, angle + .001);
  return Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
}
function span(def: StadiumDefinition, radius: number, a: number, b: number) {
  const p = footprintPoint(def, radius, a), q = footprintPoint(def, radius, b);
  return Math.hypot(p[0] - q[0], p[2] - q[2]);
}

interface Seat { point: Point; yaw: number; color: string; moduleId: number }
function seatMesh(seats: Seat[], back: boolean, material: THREE.Material) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.42, back ? .45 : .12, back ? .1 : .4), material, seats.length);
  const object = new THREE.Object3D();
  const color = new THREE.Color();
  seats.forEach((seat, i) => {
    object.position.set(...seat.point); object.rotation.set(0, seat.yaw, 0);
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
  selected?: readonly number[];
  activeModuleIds?: readonly number[];
  project?: ViewerProject | null;
  detail?: DetailLevel;
  night?: boolean;
}
export interface StadiumBuild {
  group: THREE.Group;
  roofs: THREE.Object3D[];
  stats: { seats: number; meshes: number; triangles: number };
  dispose: () => void;
}

export function buildStadium(def: StadiumDefinition, savedModules: readonly ViewerModule[], options: StadiumBuildOptions = {}): StadiumBuild {
  const detail = options.detail ?? 'medium';
  const selected = new Set(options.selected ?? []);
  const group = new THREE.Group(); group.name = def.name;
  const roofs: THREE.Object3D[] = [];
  const seats: Seat[] = [];
  const neutral = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .84, side: THREE.DoubleSide });
  const seatMaterial = new THREE.MeshStandardMaterial({ roughness: .65 });
  const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const ground = new Surface(), extras = new Surface(), glow = new Surface();
  const segments = detail === 'medium' ? 10 : 5;
  const tiersOf = (entry: ViewerModule) => (STAND_DESIGNS[entry.templateId] ?? STAND_DESIGNS['standard-two']).tiers;
  const tierRadius = (tier: number) => INNER + tier * (def.rows * RUN + 1.1);
  const tierHeight = (tier: number) => 1 + tier * (def.rows * RISE + def.tierGap);
  const resolved = savedModules.map(entry => resolveVisualModule(entry, options.activeModuleIds ?? [], options.project));
  let maxRear = INNER + def.rows * RUN, maxRoof = def.rows * RISE + 4;

  // Presentation units intentionally preserve the legacy 3.2 x 21 pitch.
  // Boundary data and match simulation are not modified by this renderer.
  for (let ring = 0; ring < 11; ring++) ground.arc(def, ring * 4, (ring + 1) * 4, -.15, 0, 0, TAU, ring % 2 ? '#3d824e' : '#448f55', 144);
  ground.arc(def, 40.2, 40.32, .015, .06, 0, TAU, '#eee8d4', 144);
  ground.arc(def, 44, 46, -.15, -.025, 0, TAU, '#a9a491', 144);
  ground.box([0,.025,0], [8,.04,24], '#728754');
  ground.box([0,.055,0], [3.2,.025,21], '#cbb47d');
  for (const z of [-10.1, 10.1, -8.9, 8.9]) ground.box([0,.085,z], [3.7,.015,.075], '#f3efe1');
  for (const z of [-10.1,10.1]) {
    for (const x of [-.18,0,.18]) ground.box([x,.45,z], [.045,.73,.045], '#f3e6bf');
    ground.box([0,.83,z], [.44,.04,.04], '#f3e6bf');
  }
  const groundMesh = ground.mesh(neutral); groundMesh.name = 'Ground'; groundMesh.raycast = NO_RAYCAST; group.add(groundMesh);

  resolved.forEach(({ entry, active }, index) => {
    const angle = index / Math.max(1, resolved.length) * TAU;
    const step = TAU / Math.max(1, resolved.length);
    const previous = resolved[(index + resolved.length - 1) % resolved.length].entry;
    const next = resolved[(index + 1) % resolved.length].entry;
    const leftGap = previous.standName === entry.standName && !previous.empty ? .001 : .009;
    const rightGap = next.standName === entry.standName && !next.empty ? .001 : .009;
    const start = angle - step / 2 + leftGap, sweep = step - leftGap - rightGap;
    const body = new Surface(), roof = new Surface();
    const design = STAND_DESIGNS[entry.templateId] ?? STAND_DESIGNS['standard-two'];
    const tiers = tiersOf(entry);
    const concrete = active ? '#aa9270' : entry.condition < 60 ? '#8f8a7f' : entry.quality === 'Elite' ? '#e1dfd3' : def.concrete;
    const trim = selected.has(entry.id) ? '#ffe274' : def.fascia;
    const rear = tierRadius(tiers - 1) + def.rows * RUN;
    const roofY = tierHeight(tiers - 1) + def.rows * RISE + 3;
    if (!entry.empty) { maxRear = Math.max(maxRear, rear); maxRoof = Math.max(maxRoof, roofY); }
    if (entry.empty) {
      body.arc(def, INNER, INNER + def.rows * RUN, -.05, .05, start, sweep, selected.has(entry.id) ? '#b29346' : '#817769', segments);
    } else {
      for (let tier = 0; tier < tiers; tier++) {
        for (let row = 0; row < def.rows; row++) {
          const radius = tierRadius(tier) + row * RUN, height = tierHeight(tier) + row * RISE;
          body.arc(def, radius, radius + RUN, tier === 0 ? 0 : height - .65, height, start, sweep, concrete, segments);
          // Central circulation stair, left free by the instanced seat generator.
          body.arc(def, radius, radius + RUN, height, height + .015, angle - step * .04, step * .08, '#d3cbb4', 2);
          if (!active) {
            const seatRadius = radius + RUN * .53;
            const spacing = design.spacing * (detail === 'low' ? 1.9 : 1) * (entry.quality === 'Elite' ? 1.08 : 1);
            const total = Math.max(1, Math.floor(span(def, seatRadius, start, start + sweep) / spacing));
            for (let j = 0; j < total; j++) {
              const f = (j + .5) / total;
              if (f < .04 || f > .96 || Math.abs(f - .5) < .058) continue;
              const a = start + sweep * f;
              seats.push({ point: footprintPoint(def, seatRadius, a, height + .24), yaw: yawAt(def,a), moduleId: entry.id, color: selected.has(entry.id) ? '#ffcf57' : entry.condition < 60 ? '#99998d' : def.seats[(Math.floor(index / 3) + tier) % def.seats.length] });
            }
          }
        }
        body.arc(def, tierRadius(tier) - .1, tierRadius(tier) + .13, tierHeight(tier), tierHeight(tier) + .7, start, sweep, trim, segments);
        const back = tierRadius(tier) + def.rows * RUN;
        body.arc(def, back, back + .5, 0, tierHeight(tier) + def.rows * RISE, start, sweep, concrete, segments);
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
      if (!active && boxes) for (let box = 0; box < boxes; box++) {
        const a = start + sweep * (.06 + .88 * (box + .5) / boxes), yaw = yawAt(def,a);
        const radius = tierRadius(Math.min(1,tiers - 1)) - .75;
        const y = tierHeight(Math.min(1,tiers - 1)) - .4;
        const width = span(def,radius,start,start+sweep) * .85 / boxes;
        body.box(footprintPoint(def,radius,a,y), [width,1.7,1.3], design.style === 'heritage' ? '#bb9b76' : '#e0dfd5', yaw);
        body.box(footprintPoint(def,radius-.62,a,y+.08), [width*.82,1.15,.09], '#335a6b', yaw);
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
      } else if (entry.roof !== 'None') {
        const depth = entry.roof === 'Partial canopy' ? 4 : entry.roof === 'Cantilever' ? Math.min(16, def.rows * RUN + 2) : 10;
        const panels = entry.roof === 'Landmark roof' || def.roofProfile !== 'flat' ? 6 : 1;
        for (let panel = 0; panel < panels; panel++) {
          const t = (panel + .5) / panels;
          const lift = def.roofProfile === 'petal' || entry.roof === 'Landmark roof' ? Math.sin(t*Math.PI)*1.45 : def.roofProfile === 'wave' ? Math.sin(t*Math.PI)*.7 : 0;
          roof.arc(def,rear-depth,rear+1.6,roofY+lift,roofY+lift+.22,start+sweep*panel/panels,sweep/panels,def.roofColor,Math.max(2,Math.ceil(segments/panels)));
        }
        for (let j = 0; j < 3; j++) {
          const a = start+sweep*(j+.5)/3, yaw = yawAt(def,a);
          body.box(footprintPoint(def,rear,a,roofY/2),[.3,roofY,.4],'#b4bdc0',yaw);
          roof.box(footprintPoint(def,rear-depth/2,a,roofY-.3),[.2,.45,depth+2],'#849296',yaw);
        }
        if (def.lights === 'ring') glow.arc(def,rear-depth,rear-depth+.45,roofY-.45,roofY-.1,start,sweep,options.night ? '#fff3c7' : '#d9d9c6',segments);
      }
    }
    const mesh = body.mesh(neutral); mesh.name = entry.standName; mesh.userData.moduleId = entry.id; group.add(mesh);
    if (!entry.empty && !active && entry.roof !== 'None') {
      const mesh = roof.mesh(neutral); mesh.name = `Roof ${entry.id}`; mesh.userData.moduleId = entry.id; roofs.push(mesh); group.add(mesh);
    }
  });
  if (seats.length) {
    group.add(seatMesh(seats,false,seatMaterial));
    if (detail === 'medium') group.add(seatMesh(seats,true,seatMaterial));
  }

  extras.arc(def,44,maxRear+12,-.55,-.2,0,TAU,'#aaa99d',144);

  // Freestanding lights live outside the largest upgraded tier, not inside it.
  for (let light = 0; light < def.mastCount; light++) {
    const angle = TAU * (light + .5) / def.mastCount;
    const height = Math.max(def.mastHeight, maxRoof + 5), radius = maxRear + 7;
    const p = footprintPoint(def,radius,angle), yaw = yawAt(def,angle);
    extras.box([p[0],height/2,p[2]],[.6,height,.6],'#acb5b8');
    extras.box([p[0],height,p[2]],[7,3.6,.65],'#737f87',yaw);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) {
      const dx = (col-3.5)*.8;
      glow.box([p[0]+Math.cos(yaw)*dx-Math.sin(yaw)*.37,height+(row-1)*1.05,p[2]-Math.sin(yaw)*dx-Math.cos(yaw)*.37],[.58,.66,.05],options.night ? '#fff1ce' : '#e5e7df',yaw);
    }
  }
  // Abstract LED screens are decorative: they do not invent match scores.
  for (const angle of def.screenAngles) {
    const radius = maxRear + 3, yaw = yawAt(def,angle), y = maxRoof + 4;
    extras.box(footprintPoint(def,radius,angle,y),[12,6,1],'#263238',yaw);
    extras.box(footprintPoint(def,radius,angle,y/2),[.8,y,.8],'#929c9b',yaw);
    glow.box(footprintPoint(def,radius-.6,angle,y),[11,5,.08],'#0b2837',yaw);
    for (let row = 0; row < 3; row++) glow.box(footprintPoint(def,radius-.68,angle,y+1.3-row*1.3),[row===0 ? 8 : 6,.3,.08],def.seats[row%def.seats.length],yaw);
  }
  const extraMesh = extras.mesh(neutral); extraMesh.raycast = NO_RAYCAST; group.add(extraMesh);
  const glowMesh = glow.mesh(glowMaterial); glowMesh.raycast = NO_RAYCAST; group.add(glowMesh);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>([neutral,seatMaterial,glowMaterial]);
  const stats = { seats: seats.length, meshes: 0, triangles: 0 };
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry); stats.meshes++;
    const triangles = (object.geometry.index?.count ?? object.geometry.getAttribute('position').count)/3;
    stats.triangles += triangles * (object instanceof THREE.InstancedMesh ? object.count : 1);
  });
  let disposed = false;
  return { group, roofs, stats, dispose() {
    if (disposed) return;
    disposed = true;
    group.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  } };
}
