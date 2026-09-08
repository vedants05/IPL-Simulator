import assert from 'node:assert/strict';
import * as THREE from 'three';
import { STADIUMS, getStadiumDefinition } from '../components/club/stadiums/definitions';
import { buildStadium } from '../components/club/stadiums/buildStadium';
import { createStadiumPlan } from '../components/club/stadiums/planGeometry';
import { metricRadius, moduleAngle, moduleIndexAt, sectionDefinition, sectionDefinitions, siteLayout, templateRadiusForMetres, venueVisualModule, TAU } from '../components/club/stadiums/siteGeometry';
import { previewModules } from './stadiumFixtures';
assert.equal(getStadiumDefinition('PBK').teamId,'PBKS','Punjab API team ID resolves to its own stadium');

for(const def of Object.values(STADIUMS)) {
  const site=siteLayout(def.teamId),modules=previewModules(def.teamId),snapshot=JSON.stringify(modules);
  const plan=createStadiumPlan(def,modules);
  assert(site.outerSources.length>0&&site.sourceDate&&site.license==='ODbL-1.0');
  for(let i=0;i<modules.length;i++) {
    assert.equal(moduleIndexAt(moduleAngle(i,modules.length),modules.length),i,'Plan/camera/3D section mapping');
    assert(!/NaN|Infinity/.test(plan.section(i)+plan.detail(i,128)+plan.connector(i)));
  }
  for(let ray=0;ray<180;ray++) {
    const angle=ray/180*TAU,frame=sectionDefinition(def,moduleIndexAt(angle,modules.length),modules.length);
    assert(Math.abs(metricRadius(frame,44,angle)-site.groundR[ray])<.001);
    assert(Math.abs(metricRadius(frame,47+frame.sectionReferenceDepth!,angle)-site.outerR[ray])<.001);
    for(const radius of [1,44,47,90,150]) assert(Math.abs(templateRadiusForMetres(frame,metricRadius(frame,radius,angle),angle)-radius)<1e-8);
  }
  assert.equal(JSON.stringify(modules),snapshot);
}
assert(siteLayout('DC').outerBounds[2]>-130,'Exclude neighbouring sports buildings from Delhi bowl');
const modules=previewModules('KKR'),snapshot=JSON.stringify(modules);
const changed=modules.map(m=>[5,6].includes(m.id)?{...m,standName:'New linked stand',templateId:'four-grandstand',constructionYear:2030}:m);
const frames=sectionDefinitions(STADIUMS.KKR,changed);
assert.equal(frames[5].rows,frames[6].rows,'Cross-boundary replacement tiers join');
assert.equal(frames[5].sectionReferenceDepth,frames[6].sectionReferenceDepth);
const before=buildStadium(STADIUMS.KKR,modules,{detail:'low'});
const after=buildStadium(STADIUMS.KKR,changed,{detail:'low'});
// Immediate neighbours open their joining seam when a shared stand is split;
// their frame stays fixed. Distant sections must remain byte-for-byte equal.
const originalFrames=sectionDefinitions(STADIUMS.KKR,modules);
for(const index of [4,7]) assert.deepEqual(frames[index],originalFrames[index]);
for(const index of [0,2,8,15,23]) {
  const a=before.group.children.find(o=>o.userData.moduleId===index) as THREE.Mesh;
  const b=after.group.children.find(o=>o.userData.moduleId===index) as THREE.Mesh;
  assert.deepEqual(a.geometry.getAttribute('position').array,b.geometry.getAttribute('position').array,'Replacement leaves other sections unchanged');
}
assert.equal(JSON.stringify(modules),snapshot);before.dispose();after.dispose();
const originalGT={...modules[0],standName:'East Bowl',templateId:'four-grandstand',constructionYear:2020};
assert.equal(venueVisualModule(STADIUMS.GT,originalGT).templateId,'standard-two');
assert.equal(venueVisualModule(STADIUMS.GT,{...originalGT,constructionYear:2030}).templateId,'four-grandstand');
assert.equal(venueVisualModule(STADIUMS.GT,{...originalGT,visualTemplateId:'four-grandstand'}).templateId,'four-grandstand','Adding tiers preserves the old construction date but must render the new template');
assert.equal(originalGT.templateId,'four-grandstand');
console.log('PASS: ten sourced footprints, section mapping, cross-boundary replacement, unchanged neighbours, immutable saves and original/upgraded GT compatibility.');
