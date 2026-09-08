import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Performance policy, not a promise of a particular frame rate. Ignore idle
// gaps and shader warm-up. Change pixel density before sacrificing geometry.
export class AdaptiveStadiumQuality {
  scale=1.5;
  private frames=0;
  private average=18;
  private lastChange=0;
  sample(delta:number):boolean {
    if(!Number.isFinite(delta)||delta<=0||delta>.5) return false;
    this.frames++;
    this.average=this.average*.95+delta*1000*.05;
    if(this.frames<35||this.frames-this.lastChange<60) return false;
    const next=this.average>25?Math.max(.85,this.scale-.2):this.average<17&&this.frames-this.lastChange>360?Math.min(1.75,this.scale+.1):this.scale;
    if(Math.abs(next-this.scale)<.01) return false;
    this.scale=next;this.lastChange=this.frames;return true;
  }
}

export function initialStadiumScale(renderer:THREE.WebGLRenderer):number {
  const context=renderer.getContext(),extension=context.getExtension('WEBGL_debug_renderer_info');
  const name=extension?String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL)):'';
  // This laptop can launch Chrome on the 780M despite its discrete RTX GPU.
  return /780M|760M|680M|Iris|UHD|Intel|SwiftShader|llvmpipe/i.test(name)?1.1:1.5;
}

export function createStadiumPostprocessing(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera) {
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:2});
  const composer=new EffectComposer(renderer,target);
  const beauty=new RenderPass(scene,camera);
  const ao=new SSAOPass(scene,camera,1,1,12);
  ao.kernelRadius=1.8;ao.minDistance=.0001;ao.maxDistance=.012;
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.16,.3,1.15);
  const output=new OutputPass();
  composer.addPass(beauty);composer.addPass(ao);composer.addPass(bloom);composer.addPass(output);
  return {
    resize(width:number,height:number,scale:number) {
      const density=Math.min(scale,Math.sqrt(2_800_000/Math.max(1,width*height)));
      composer.setPixelRatio(density);composer.setSize(width,height);
      // AO needs less resolution than fine seat edges and signage.
      ao.setSize(Math.max(1,Math.round(width*density*.65)),Math.max(1,Math.round(height*density*.65)));
      ao.enabled=scale>1.2;
    },
    render(delta:number) {
      // Inspection zoom changes the projection without rebuilding the pass.
      ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      composer.render(delta);
    },
    // r170 SSAOPass.dispose omits these two resources.
    dispose() {beauty.dispose();ao.dispose();ao.ssaoMaterial.dispose();ao.noiseTexture.dispose();bloom.dispose();output.dispose();composer.dispose();},
  };
}
