import * as THREE from 'three';

// Logical regions only: never split, clip, hide or move authored geometry.
// IDs are the existing saved-builder slots, independent of editable stand names.
export interface EdenRegion { axis: 'angle' | 'x'; start: number; end: number; ids: readonly number[] }
const angle = (start: number, end: number, ids: number[]): EdenRegion => ({ axis: 'angle', start: start*Math.PI/180, end: end*Math.PI/180, ids });
export const EDEN_REGIONS: Record<string, EdenRegion> = {
  ClubHouse: { axis: 'x', start: -28, end: 28, ids: [0,1] },
  Stand_B: angle(126,162,[3,2]), Stand_C: angle(90,126,[5,4]),
  Stand_D: angle(30,86,[8,7,6]), Stand_E: angle(8,26,[11,10,9]),
  Stand_F: angle(-21,8,[14,13,12]), Stand_G: angle(-49,-21,[16,15]),
  Stand_H: angle(-77,-49,[18,17]), Stand_J: angle(-100,-77,[19]),
  Stand_K: angle(-130,-100,[20]), Stand_L: angle(-162,-130,[21]),
  // Legacy High Court Pavilion slots correspond to the north recess, not a
  // fabricated second pavilion. Keep these IDs so existing saves remain valid.
  SightScreen_North: { axis: 'x', start: -13, end: 13, ids: [22,23] },
};

const aliases: Record<string,string[]> = {
  Roof_BC: ['Stand_C','Stand_B'], Exterior_BC: ['Stand_C','Stand_B'],
  Roof_KL: ['Stand_L','Stand_K'], Exterior_KL: ['Stand_L','Stand_K'],
  Exterior_ClubHouse: ['ClubHouse'], SightScreen_ClubHouse: ['ClubHouse'],
  Scoreboard_Electronic_E: ['Stand_E'], Scoreboard_Traditional_D: ['Stand_D'],
};
export function edenRegionsForObject(object: THREE.Object3D): EdenRegion[] {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    for (const key of [node.userData.part, node.name]) {
      if (EDEN_REGIONS[key]) return [EDEN_REGIONS[key]];
      if (aliases[key]) return aliases[key].map(name => EDEN_REGIONS[name]);
    }
  }
  return [];
}

export function edenModuleAt(regions: readonly EdenRegion[], point: { x:number; z:number }): number | undefined {
  if (!regions.length) return undefined;
  const value = regions[0].axis === 'x' ? point.x : Math.atan2(point.x,-point.z);
  const region = regions.find(r => value < r.end) ?? regions[regions.length-1];
  const index = Math.max(0,Math.min(region.ids.length-1,Math.floor((value-region.start)/(region.end-region.start)*region.ids.length)));
  return region.ids[index];
}

/** Colour-only adapter. Shared roofs remain a single mesh and seat instancing
 * is retained. Picking and highlighting use the exact same logical boundaries. */
export function attachEdenModules(scene: THREE.Object3D) {
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const cache = new Map<string,THREE.Material>();
  const updates: Array<{ ids:number[]; uniform:{value:number[]} }> = [];
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const regions = edenRegionsForObject(object);
    if (!regions.length) return;
    const ids = regions.flatMap(region => [...region.ids]);
    const cuts = regions.flatMap(region => region.ids.map((_,i) => region.start+(region.end-region.start)*(i+1)/region.ids.length));
    const make = (original: THREE.Material) => {
      const key = `${original.uuid}:${ids.join(',')}`;
      const found = cache.get(key);
      if (found) return found;
      const material = original.clone();
      const uniform = {value:ids.map(() => 0)};
      updates.push({ids,uniform});
      material.onBeforeCompile = shader => {
        shader.uniforms.edenState = uniform;
        shader.vertexShader = 'varying vec3 edenPosition;\n'+shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 edenLocal = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            edenLocal = instanceMatrix * edenLocal;
          #endif
          edenPosition = (modelMatrix * edenLocal).xyz;`);
        shader.fragmentShader = `varying vec3 edenPosition;\nuniform float edenState[${ids.length}];\n`+shader.fragmentShader;
        const coordinate = regions[0].axis === 'x' ? 'edenPosition.x' : 'atan(edenPosition.x, -edenPosition.z)';
        const choose = ids.slice(0,-1).map((_,i) => `${i?'else ':''}if (edenCoordinate < ${cuts[i].toFixed(9)}) edenHighlight = edenState[${i}];`).join('\n');
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float edenCoordinate = ${coordinate};
          float edenHighlight = edenState[${ids.length-1}];
          ${choose}
          if (edenHighlight > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb,
            edenHighlight > 1.5 ? vec3(1.0,0.48,0.08) : vec3(1.0,0.76,0.16), 0.48);`);
      };
      material.customProgramCacheKey = () => `eden-logical-v1:${regions[0].axis}:${ids.join(',')}`;
      cache.set(key,material);
      return material;
    };
    originals.set(object,object.material);
    object.material = Array.isArray(object.material) ? object.material.map(make) : make(object.material);
  });
  return {
    setState(selected: readonly number[], active: readonly number[] = []) {
      updates.forEach(({ids,uniform}) => ids.forEach((id,i) => { uniform.value[i] = selected.includes(id)?1:active.includes(id)?2:0; }));
    },
    dispose() {
      originals.forEach((material,mesh) => { mesh.material = material; });
      cache.forEach(material => material.dispose());
    },
  };
}
