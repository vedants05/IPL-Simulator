import assert from 'node:assert/strict';
import { reconcileStoredStadiumProject } from '../components/club/StadiumBuilderPage';

const storage=new Map<string,string>();
Object.assign(globalThis,{window:{},localStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
const key='ipl-stadium-builder:eden-preservation-test:KKR:v2';
const modules=[0,1,2].map(id=>({id,standName:`Original ${id}`,templateId:'standard-two',roof:id===0?'None':'Partial canopy',capacity:2000,baseCapacity:2000,quality:'Modern',condition:70,constructionYear:1987,lastRefurbishedYear:2011,maxTiers:3,fanOpinion:75}));
const project={id:'refurb-test',moduleIds:[0,1],action:'refurbish',preserveImportedDesign:true,phase:'construction',templateId:'standard-two',quality:'Elite',roof:'Landmark roof',startedOn:'2026-01-01',constructionStartsOn:'2026-01-01',constructionCompletesOn:'2026-05-01'};
storage.set(key,JSON.stringify({modules,plans:[],projectHistory:[],activeProject:project}));
assert.equal(reconcileStoredStadiumProject({teamId:'KKR',saveId:'eden-preservation-test',currentDate:'2026-05-02'}),6000);
const completed=JSON.parse(storage.get(key)!);
assert.equal(completed.activeProject.phase,'completed');
for(const id of [0,1]) {
  assert.deepEqual(completed.modules[id],{...modules[id],quality:'Elite',condition:100,lastRefurbishedYear:2026});
}
assert.deepEqual(completed.modules[2],modules[2]);
assert.equal(completed.projectHistory.length,1);
const saved=storage.get(key);
reconcileStoredStadiumProject({teamId:'KKR',saveId:'eden-preservation-test',currentDate:'2026-05-03'});
assert.equal(storage.get(key),saved,'Repeated clock reconciliation is idempotent');
console.log('PASS: saved refurbishment completes, improves only selected modules, preserves each original roof/design/capacity, and is idempotent.');
