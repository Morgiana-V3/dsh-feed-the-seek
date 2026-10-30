import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { apply } from '../src/dsh.js';
import { Store } from '../src/store.js';
import { Engine } from '../src/engine.js';
import { DEFAULT_SCOPE } from '../src/types.js';

const installed = existsSync(join(process.env.DSH_HOME || join(homedir(),'.dsh'),'profiles/node_modules/@deepseek-ai/dsh-tools'));
test('installed DSH SDK contract: stable profile, turn snapshots, background learning, QQ user source and isolation', {skip:!installed}, async t => {
  const dir=mkdtempSync(join(tmpdir(),'yuwen-adapter-'));
  const store=new Store(join(dir,'memory.sqlite'));
  const engine=new Engine(store);
  const project=process.platform==='win32'?resolve(dir).toLowerCase():resolve(dir);
  store.source({id:'seed',session:'seed',role:'user',text:'先验证再报告完成',scope:{...DEFAULT_SCOPE,project},at:new Date().toISOString()});
  engine.apply({operations:[{action:'ADD',kind:'cognition',knowledge:{category:'preference'},text:'先验证再报告完成',global:true,sources:['seed'],reason:'用户明确提出'}]},{...DEFAULT_SCOPE,project},[],['seed']);
  const handlers=new Map<string,Function[]>();
  const sections:any[]=[];
  const agentSections = new Map<string, any[]>();
  const registered:any[]=[];
  const a:any={id:'test-a',session:{id:'test-a',header:{cwd:dir},requestHeader:()=>({config:{provider:'test-provider',model:'test-model'}})},ctx:{systemPrompt:{section:(section:unknown)=>{sections.push(section);return()=>{};}}}};
  agentSections.set(a.id, sections);
  const agents:any[]=[a];
  let calls=0;
  const ctx={
    inject:()=>{},
    get:()=>undefined,
    on:(name:string,fn:Function)=>{const list=handlers.get(name)||[];list.push(fn);handlers.set(name,list);return()=>{const i=list.indexOf(fn);if(i>=0)list.splice(i,1);};},
    agents:{list:()=>agents,get:(id:string)=>agents.find(a=>a.id===id)},
    tools:{register:(tool:any)=>{registered.push(tool);return()=>{};}},
    llm:{async *stream(input:any){
      calls++;assert.equal(input.provider,'test-provider');assert.equal(input.model,'test-model');
      assert.equal(Object.hasOwn(input,'maxTokens'),false,'learning must not impose an output token cap');
      const payload=JSON.parse(input.messages[0].content[0].text);
      assert.ok(payload.events.some((s:any)=>s.id==='test-a:2'),'the original user survives more than 12 assistant events');
      assert.ok(!payload.events.some((s:any)=>s.id==='test-a:3'),'injected plugin messages are not user evidence');
      yield {type:'text-delta',text:JSON.stringify({operations:[{action:'ADD',kind:'cognition',knowledge:{category:'preference'},text:'方案比较先说推荐结果',evidence:'explicit',global:true,sources:['test-a:2'],reason:'用户提出偏好'}]})};
      yield {type:'finish',reason:{kind:'stop'}};
    }},
  };
  const emit=async(name:string,...args:any[])=>{for(const fn of [...(handlers.get(name)||[])])await fn(...args);};
  await apply(ctx,{dataDir:dir,dashboardPort:0});
  t.after(async()=>{await emit('dispose');store.close();rmSync(dir,{recursive:true,force:true});});
  assert.equal(sections.length,1);assert.equal(registered[0].name,'yuwen_recall');
  const assemble=async(agent:any)=>{const assembly={sections:(agentSections.get(agent.id) || []).map(section => ({...section, text:section.text()})),contexts:[],tools:[],variables:{}};return handlers.get('system-prompt/assemble')![0](assembly,{agent},async()=>assembly);};
  await emit('agent/inbox/claimed',{agent:a,message:{source:{kind:'user'},content:[{type:'text',text:'方案比较先说推荐结果'}]}});
  assert.match((await assemble(a)).sections[0].text,/先验证/);
  assert.equal((await assemble(a)).contexts.length, 0, 'stable preferences are not duplicated in runtime context');
  const event=async(type:string,seq:number,data:any)=>emit('session/event',a.session,{type,seq,time:new Date().toISOString(),data});
  await event('turn/start',1,{turn:1});
  await event('user/message',2,{source:{kind:'user'},content:[{type:'text',text:'方案比较先说推荐结果'}]});
  await event('user/message',3,{source:{kind:'plugin'},content:[{type:'text',text:'不应被学成用户偏好'}]});
  for(let i=4;i<20;i++)await event('assistant/message',i,{message:{content:[{type:'text',text:'工作中的进展'}]}});
  await event('step/end',20,{step:5});
  for(let i=0;i<100&&store.db.prepare("SELECT status FROM jobs").get()?.status!=='done';i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(calls,1);assert.equal(store.db.prepare('SELECT status FROM jobs').get()?.status,'done');
  assert.doesNotMatch((await assemble(a)).sections[0].text,/方案比较先说推荐结果/, 'stable layer remains fixed within a turn');
  await event('turn/end',21,{});
  await event('turn/start',22,{turn:2});
  assert.match((await assemble(a)).sections[0].text,/方案比较先说推荐结果/);
  const bSections:any[]=[];
  const b={...a,id:'test-b',session:{...a.session,id:'test-b'},ctx:{systemPrompt:{section:(section:any)=>{bSections.push(section);return()=>{};}}}};
  agentSections.set(b.id,bSections);agents.push(b);await emit('agent/created',{agent:b});
  assert.match((await assemble(b)).sections[0].text,/先验证/);
  // QQ bridges that produce source.kind=user enter the same context assembly path.
  const qqMessage = {source:{kind:'user',channel:'qq',chatType:'c2c',senderId:'fixture-owner'},content:[{type:'text',text:'回声戒指'}]};
  await emit('agent/inbox/claimed',{agent:b,message:qqMessage});
  assert.equal((await assemble(b)).contexts.length,0);
  store.source({id:'knowledge',session:'another-session',role:'user',text:'回声戒指让普通技能再触发一次',scope:DEFAULT_SCOPE,at:new Date().toISOString()});
  engine.apply({operations:[{action:'ADD',kind:'cognition',knowledge:{category:'rule',domain:'雾港'},text:'回声戒指让普通技能再触发一次',global:true,sources:['knowledge'],reason:'明确规则'}]},DEFAULT_SCOPE,[],['knowledge']);
  assert.equal((await assemble(b)).contexts.length,0,'a snapshot stays fixed during the current turn');
  await emit('agent/inbox/claimed',{agent:b,message:qqMessage});
  assert.match((await assemble(b)).contexts[0].text,/再触发一次/,'identical text in a new message must refresh the snapshot');
  assert.match((await assemble(b)).sections[0].text,/先验证/,'QQ user input receives the same stable profile');
  // An arbitrary plugin message is not silently reclassified as personal user evidence.
  await emit('session/event',b.session,{type:'turn/start',seq:1,data:{turn:1}});
  await emit('session/event',b.session,{type:'user/message',seq:2,data:{source:{kind:'plugin',plugin:'fixture-qq'},content:[{type:'text',text:'不属于已验证的用户来源'}]}});
  await emit('session/event',b.session,{type:'turn/end',seq:3,data:{}});
  assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE id LIKE 'test-b:%'").get()?.n,0);
  store.createPersona('新实例');
  const cSections:any[]=[];
  const c={...a,id:'test-c',session:{...a.session,id:'test-c'},ctx:{systemPrompt:{section:(section:any)=>{cSections.push(section);return()=>{};}}}};agentSections.set(c.id,cSections);agents.push(c);await emit('agent/created',{agent:c});
  assert.equal((await assemble(c)).contexts.length,0);assert.match((await assemble(b)).sections[0].text,/先验证/);
  await assemble(a);await assemble(a);
  assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM recall_uses WHERE memory_id=(SELECT id FROM memories WHERE json_extract(document,'$.text')='先验证再报告完成')").get()?.n,0,'stable profile display must not reinforce a memory');
  store.toggleSession(a.id,false);assert.equal((await assemble(a)).contexts.length,0);assert.match((await assemble(b)).sections[0].text,/先验证/);assert.equal((await assemble(a)).sections[0].text,'');
});

