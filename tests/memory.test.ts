import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Engine } from '../src/engine.js';
import { Learner } from '../src/learning.js';
import { seedDemo, demoStep, DEMO_SCOPE } from '../src/demo.js';
import { createDashboard } from '../src/server.js';
import type { Scope, Source } from '../src/types.js';

const scope: Scope = {user:'owner',persona:'yuwen',project:'project-a'};
function setup() { const store = new Store(':memory:'); return {store,engine:new Engine(store)}; }
function source(store: Store,id='source-1',session='session-1',customScope=scope): Source {
  const record={id,session,role:'user',text:'请先验证再报告完成',scope:customScope,at:new Date().toISOString()};store.source(record);return record;
}
function add(engine:Engine,text='先验证再报告完成') {
  source(engine.store);
  return engine.apply({operations:[{action:'ADD',kind:'cognition',knowledge:{category:'preference'},text,evidence:'explicit',sources:['source-1'],reason:'用户明确要求',global:true}]},scope,[],['source-1'])[0];
}

test('cross-session recall retains global habits but isolates project episodes and other users',async t=>{
 const {store,engine}=setup();t.after(()=>store.close());add(engine);
 engine.apply({operations:[{action:'ADD',kind:'experience',text:'登录失败源于项目 A 的缓存',sources:['source-1'],reason:'记录项目经历'}]},scope,[],['source-1']);
 // 0.2.15: global habits live in the stable layer; the project episode stays out of other projects.
 assert.match(engine.stableContext({...scope,project:'project-b'}).text,/先验证再报告完成/);
 const next=await engine.recall({...scope,project:'project-b'},'登录缓存',undefined,{deliberate:true});assert.equal(next.items.length,1);assert.equal(next.items[0].memory.kind,'cognition');
 assert.equal((await engine.recall({...scope,project:'project-b'},'登录缓存')).items.some(i=>i.memory.kind==='experience'),false);
 assert.equal((await engine.recall({...scope,user:'someone-else'},'验证',undefined,{deliberate:true})).items.length,0);
 assert.equal(engine.stableContext({...scope,user:'someone-else'}).text,'');
});
test('UPDATE and DELETE use exact versions; stale and unauthorized batches roll back',t=>{
 const {store,engine}=setup();t.after(()=>store.close());const m=add(engine);
 const op={action:'UPDATE',target:m.id,expectedVersion:1,kind:'cognition',knowledge:{category:'preference'},text:'先运行相关验证，再简短报告结果',sources:['source-1'],reason:'进一步明确'};
 engine.apply({operations:[op]},scope,[m.id],['source-1']);assert.equal(store.memory(m.id)?.version,2);
 assert.throws(()=>engine.apply({operations:[op]},scope,[m.id],['source-1']),/版本/);
 const before=store.memories().length;
 assert.throws(()=>engine.apply({operations:[{action:'ADD',kind:'experience',text:'不应该提交',sources:['source-1'],reason:'测试事务'},op]},scope,[m.id],['source-1']));assert.equal(store.memories().length,before);
 engine.apply({operations:[{action:'DELETE',target:m.id,expectedVersion:2,sources:['source-1'],reason:'用户撤销'}]},scope,[m.id],['source-1']);assert.equal(store.memories().length,0);assert.equal(store.history().length,3);
});
test('source identity is immutable and unknown evidence is rejected',t=>{
 const {store,engine}=setup();t.after(()=>store.close());const s=source(store);
 assert.throws(()=>store.source({...s,text:'篡改'}),/覆盖/);
 assert.throws(()=>engine.apply({operations:[{action:'ADD',kind:'cognition',knowledge:{category:'preference'},text:'凭空生成',sources:['missing'],reason:'不存在的证据'}]},scope,[],['missing']),/来源/);
});

test('ADD cannot bypass target authorization or overwrite another user record',t=>{
 const {store,engine}=setup();t.after(()=>store.close());const m=add(engine);
 assert.throws(()=>engine.apply({operations:[{action:'ADD',target:m.id,kind:'cognition',knowledge:{category:'preference'},text:'绕过更新校验',sources:['source-1'],reason:'恶意目标'}]},scope,[],['source-1']),/新增操作/);
 assert.equal(store.memory(m.id)?.version,1);
});
test('one-off self observations stay separate from stable traits',t=>{
 const {store,engine}=setup();t.after(()=>store.close());source(store);source(store,'source-2','session-2');
 const op={action:'ADD',kind:'self',text:'形成验证后交付的习惯',sources:['source-1'],reason:'重复观察',consolidate:true};
 engine.apply({operations:[op]},scope,[],['source-1']);assert.equal(store.memories()[0].kind,'self');assert.equal(store.traits(scope).length,0);
 engine.apply({operations:[{...op,action:'UPDATE',target:store.memories()[0].id,expectedVersion:1,sources:['source-1','source-2']}]},scope,[store.memories()[0].id],['source-1','source-2']);assert.equal(store.traits(scope).length,0);
});
test('sqlite-vec performs real semantic distance; changed memory invalidates its vector',async t=>{
 const store=new Store(':memory:');t.after(()=>store.close());assert.equal(store.vectorAvailable,true);
 store.saveSettings({...store.settings(),retrievalMode:'semantic'});
 const embedder={key:'test-space-v1',embed:async(text:string)=>text.includes('猫')?[0,1,0]:[1,0,0]};
 const engine=new Engine(store,embedder);source(store);
 const m=engine.apply({operations:[{action:'ADD',kind:'experience',text:'用户希望减少低风险确认',sources:['source-1'],reason:'测试语义召回'}]},scope,[],['source-1'])[0];
 await engine.index(scope);const result=await engine.recall(scope,'小事自行处理');assert.equal(result.mode,'hybrid');assert.equal(result.items[0].memory.id,m.id);assert.ok(result.items[0].reasons.some(x=>x.includes('语义')));
 engine.apply({operations:[{action:'UPDATE',target:m.id,expectedVersion:1,kind:'experience',text:'用户喜欢猫',sources:['source-1'],reason:'更正'}]},scope,[m.id],['source-1']);assert.equal(store.vectorVersion(m.id,embedder.key),undefined);
 await engine.index(scope);assert.equal((await engine.recall(scope,'小事自行处理')).items.length,0);
});
test('temporary mood decays and unrelated projects do not inherit it',async t=>{
 const {store,engine}=setup();t.after(()=>store.close());source(store);
 store.setState(scope,{mood:'discouraged',reason:'登录问题尚未解决',behavior:'先定位登录原因',intensity:.4,sources:['source-1'],topic:'登录'});
 assert.ok((await engine.recall(scope,'登录')).states.length);assert.equal(store.states({...scope,project:'other'}).length,0);
 assert.equal(store.states(scope,Date.now()+7*86400000).length,0);
});
test('disabled memory is empty; paused learning rejects writes and no manual API exists',async t=>{
 const {store,engine}=setup();t.after(()=>store.close());const m=add(engine);store.saveSettings({...store.settings(),enabled:false});assert.equal((await engine.recall(scope,'验证')).context,'');
 assert.throws(()=>engine.apply({operations:[]},scope,[],[]),/暂停/);
 assert.equal('manual' in engine,false);assert.equal(store.memory(m.id)?.version,1);
});
test('template braces in memory remain literal instead of becoming host variables',async t=>{
 const {store,engine}=setup();t.after(()=>store.close());add(engine,'用户喜欢 {{example}} 风格的模板说明');const result=await engine.recall(scope,'模板');assert.ok(!result.context.includes('{{'));
});
test('knowledge correction replaces a claim while editions coexist; experience resolves without a todo',async t=>{
 const {store,engine}=setup();t.after(()=>store.close());seedDemo(engine);const count=store.memories().length;seedDemo(engine);assert.equal(store.memories().length,count);
 demoStep(engine,1);const old=store.memories().find(m=>m.knowledge.edition==='1.0')!;assert.equal(old.version,2);assert.match(old.text,/对终结技无效/);
 demoStep(engine,2);assert.equal(store.memories().filter(m=>m.knowledge.edition).length,2);
 const recall=await engine.recall({...DEMO_SCOPE,project:'another'},'回声戒指');assert.ok(recall.items.some(i=>i.memory.knowledge.edition==='1.0'));assert.ok(recall.items.some(i=>i.memory.knowledge.edition==='2.0'));
 demoStep(engine,3);assert.equal(store.states(DEMO_SCOPE)[0].mood,'relieved');assert.match(store.memories().find(m=>m.kind==='experience')!.text,/验证通过/);
 const revised=store.revision;demoStep(engine,3);assert.equal(store.revision,revised);
});
test('background learning records a committed job once',async t=>{
 const {store,engine}=setup();const s=source(store);let count=0;
 const learner=new Learner(engine,()=>async()=>{count++;return JSON.stringify({operations:[{action:'ADD',kind:'cognition',knowledge:{category:'preference'},text:'先验证再交付',sources:[s.id],reason:'用户要求',evidence:'explicit'}]});});
 t.after(async()=>{await learner.close();store.close();});
 const job={id:'job-1',scope,sources:[s]};learner.enqueue(job);while(learner.running)await new Promise(r=>setTimeout(r,5));
 assert.equal(store.db.prepare('SELECT status FROM jobs WHERE id=?').get(job.id)?.status,'done');learner.enqueue(job);await learner.drain();assert.equal(count,1);
});
test('dashboard rejects cross-origin writes and safely handles invalid operations',async t=>{
 const {store,engine}=setup();const app=createDashboard(engine,{demo:true,port:0});await app.listen();
 t.after(async()=>{await new Promise<void>(r=>app.server.close(()=>r()));store.close();});
 const address=app.server.address();assert.ok(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}`;
 const data=await(await fetch(`${base}/api/state`)).json() as {token:string};
 assert.equal((await fetch(`${base}/api/settings`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(`${base}/api/settings`,{method:'POST',headers:{'content-type':'application/json','x-yuwen-token':data.token,origin:'https://example.com'},body:'{}'})).status,403);
 assert.equal((await fetch(`${base}/api/memory`,{method:'POST',headers:{'content-type':'application/json','x-yuwen-token':data.token},body:JSON.stringify({text:'伪造记忆',kind:'cognition',scope})})).status,404);
});

test('one paused job does not starve other sessions; failed proposals can be retried',async t=>{
 const {store,engine}=setup();const s=source(store);const other=source(store,'other-source','other-session');store.toggleSession(s.session,false);let calls=0;
 const learner=new Learner(engine,()=>async()=>{calls++;return calls<=2?'invalid JSON':JSON.stringify({operations:[]});});
 t.after(async()=>{await learner.close();store.close();});
 learner.enqueue({id:'paused',scope,sources:[s]});learner.enqueue({id:'ready',scope,sources:[other]});
 while(learner.running)await new Promise(r=>setTimeout(r,5));
 // The second enqueue may arrive while the first drain is settling.
 await learner.drain();
 assert.equal(store.db.prepare("SELECT status FROM jobs WHERE id='ready'").get()?.status,'failed');
 learner.retry();while(learner.running)await new Promise(r=>setTimeout(r,5));
 assert.equal(store.db.prepare("SELECT status FROM jobs WHERE id='ready'").get()?.status,'done');
 assert.equal(store.db.prepare("SELECT status FROM jobs WHERE id='paused'").get()?.status,'pending');
});


test('growth counts independent user events and time, never assistant repetitions or session count',async t=>{
 const {store,engine}=setup();t.after(()=>store.close());
 const evidence:Source[]=Array.from({length:3},(_,i)=>({id:`growth-${i}`,session:'one-long-session',event:`turn-${i}`,role:'user',text:'这次也先验证再交付，符合我的要求',scope,at:new Date(Date.now()-(4-i*2)*86400000).toISOString()}));
 evidence.forEach(s=>store.source(s));
 const op={action:'ADD',kind:'self',knowledge:{category:'tendency'},text:'交付之前先验证，再描述完成范围。',sources:evidence.map(s=>s.id),reason:'三个不同日期的实际用户反馈',consolidate:true,global:true};
 const m=engine.apply({operations:[op]},scope,[],op.sources)[0];assert.equal(store.traits(scope).length,1);
 // 0.2.15: formed tendencies are part of "who she is" in the stable layer, shown in every conversation.
 assert.match(engine.stableContext({...scope,project:'other'}).text,/交付之前先验证/);
 const repeated=evidence.map((s,i)=>({...s,id:`repeat-${i}`,event:'same-turn'}));repeated.forEach(s=>store.source(s));
 engine.apply({operations:[{...op,text:'另一个未经独立验证的倾向',sources:repeated.map(s=>s.id)}]},scope,[],repeated.map(s=>s.id));assert.equal(store.traits(scope).length,1);
 const assistant=evidence.map((s,i)=>({...s,id:`assistant-${i}`,role:'assistant'}));assistant.forEach(s=>store.source(s));
 engine.apply({operations:[{...op,text:'助手反复自称已经成长',sources:assistant.map(s=>s.id)}]},scope,[],assistant.map(s=>s.id));assert.equal(store.traits(scope).length,1);
 engine.apply({operations:[{action:'DELETE',target:m.id,expectedVersion:m.version,sources:[evidence[2].id],reason:'新反馈撤销此前理解'}]},scope,[m.id],[evidence[2].id]);assert.equal(store.traits(scope).length,0);assert.ok(store.history().some(h=>h.action==='CONSOLIDATE'));
});

test('cold knowledge remains retrievable; repeated prompt steps and preview do not inflate reinforcement',async t=>{
 const {store,engine}=setup();t.after(()=>store.close());source(store);
 // 0.2.15: objective rules no longer fade, so this cold-memory check uses an opinion, which does.
 const m=engine.apply({operations:[{action:'ADD',kind:'cognition',knowledge:{category:'opinion',domain:'虚构私服'},text:'星砂能够修复破损护符',global:true,sources:['source-1'],reason:'用户对私服道具的看法'}]},scope,[],['source-1'])[0];
 store.put({...m,updatedAt:'2020-01-01T00:00:00Z'});
 const old=store.memory(m.id)!;const now=Date.now();const activation=store.activation(old,now);assert.ok(activation<.01);
 // A forgotten memory stays out of automatic injection but a deliberate recall still finds it.
 assert.equal((await engine.recall({...scope,project:'other'},'星砂修复护符')).items.length,0);
 const recalled=await engine.recall({...scope,project:'other'},'星砂修复护符',undefined,{deliberate:true});assert.equal(recalled.items[0].memory.id,m.id);assert.equal(store.activation(old,now),activation);
 for(let i=0;i<50;i++)store.use([old],'same-turn');assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM recall_uses').get()?.n,1);assert.ok(store.activation(old)>.99);
 assert.equal(store.memory(m.id)?.confidence,m.confidence);assert.equal(store.memory(m.id)?.importance,m.importance);assert.equal(store.memory(m.id)?.version,m.version);
});

test('new persona has no inherited evidence, mood, profile or vectors; old sessions stay bound',async t=>{
 const {store,engine}=setup();t.after(()=>store.close());const m=add(engine);store.bindSession('old-session');
 store.setState(scope,{mood:'concerned',reason:'验证失败',behavior:'先验证',intensity:.4,sources:m.sources,topic:'验证'});
 const persona=store.createPersona('第二只');const next={...scope,persona:persona.id};
 assert.equal(store.bindSession('old-session'),scope.persona);assert.equal(store.bindSession('new-session'),persona.id);
 assert.equal((await engine.recall(next,'验证')).context,'');assert.equal(store.traits(next).length,0);assert.equal(store.states(next).length,0);
 assert.throws(()=>engine.apply({operations:[{action:'ADD',kind:'cognition',text:'偷取旧实例',sources:m.sources,reason:'不合法'}]},next,[m.id],m.sources),/来源/);
 assert.ok((await engine.recall(scope,'验证')).items.length);
});

test('HTTP state and export show only the selected persona, and a new instance is empty',async t=>{
 const {store,engine}=setup();add(engine);const app=createDashboard(engine,{demo:false,port:0});await app.listen();
 t.after(async()=>{await new Promise<void>(r=>app.server.close(()=>r()));store.close();});const addr=app.server.address();assert.ok(addr&&typeof addr==='object');const base=`http://127.0.0.1:${addr.port}`;
 const before:any=await(await fetch(base+'/api/state')).json();
 const post=async(path:string,body:unknown)=>fetch(base+'/api/'+path,{method:'POST',headers:{'content-type':'application/json','x-yuwen-token':before.token},body:JSON.stringify(body)});
 const persona:any=await(await post('persona',{name:'空白实例'})).json();assert.ok(persona.id);
 const next:any=await(await fetch(base+'/api/state')).json();assert.equal(next.scope.persona,persona.id);assert.deepEqual(next.memories,[]);assert.deepEqual(next.sources,{});assert.deepEqual(next.history,[]);
 const exported:any=await(await post('export',{scope:next.scope})).json();assert.deepEqual(exported.memories,[]);
 const previous:any=await(await fetch(base+'/api/state?persona='+scope.persona)).json();assert.equal(previous.memories.length,1);
 const invalid=await post('recall',{scope:{...scope,persona:'unknown'},query:'验证'});assert.equal(invalid.status,400);
});

test('replayed emotional evidence does not reset its decay clock',t=>{
 const {store}=setup();t.after(()=>store.close());source(store);
 const input={mood:'concerned' as const,reason:'验证未过',behavior:'继续验证',intensity:.3,sources:['source-1'],topic:'验证'};store.setState(scope,input);
 const s=store.states(scope)[0];const old={...s,updatedAt:'2026-01-01T00:00:00Z'};store.db.prepare('UPDATE states SET document=? WHERE id=?').run(JSON.stringify(old),s.id);
 store.setState(scope,{...input,reason:'同一事件的另一种摘要'});assert.equal(store.states(scope).length,0);
});

test('global cognition can use its original evidence from a different project during refinement',async t=>{
 const {store,engine}=setup();t.after(()=>store.close());const m=add(engine);const next={...scope,project:'b'};const s=source(store,'new-feedback','next-session',next);
 engine.apply({operations:[{action:'UPDATE',target:m.id,expectedVersion:1,kind:'cognition',knowledge:{category:'preference'},text:'验证后报告，也说明尚未验证的范围',sources:[...m.sources,s.id],reason:'补充跨项目通用偏好'}]},next,[m.id],[...m.sources,s.id]);
 assert.equal(store.memory(m.id)?.version,2);assert.equal(store.memory(m.id)?.scope.project,'');
});


test('legacy migration retains old goals as experiences and never promotes legacy growth automatically',async t=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'fish-migration-'));const path=join(dir,'memory.sqlite');let store=new Store(path);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const legacy={id:'legacy-goal',kind:'goal',text:'登录仍待验证',tags:[],scope,evidence:'explicit',importance:.5,status:'active',version:3,sources:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 store.db.prepare('INSERT INTO memories VALUES (?,?)').run(legacy.id,JSON.stringify(legacy));
 store.db.prepare('INSERT INTO memories VALUES (?,?)').run('legacy-growth',JSON.stringify({...legacy,id:'legacy-growth',kind:'growth',text:'两次会话总结出的成长'}));
 store.setMeta('schemaVersion',1);store.close();store=new Store(path);
 assert.equal(store.memory('legacy-goal')?.kind,'experience');assert.equal(store.memory('legacy-goal')?.version,3);assert.equal(store.memory('legacy-growth')?.kind,'self');assert.equal(store.traits(scope).length,0);
 assert.equal(store.history().filter(h=>h.action==='MIGRATE').length,2);const revision=store.revision;store.close();store=new Store(path);assert.equal(store.revision,revision);
});
