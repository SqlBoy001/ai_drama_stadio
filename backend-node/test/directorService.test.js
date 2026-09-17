const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runMigrationsAndEnsure } = require('../src/db/migrate');
const director = require('../src/services/directorService');
const ai = require('../src/services/aiClient');
const log = { info(){}, warn(){}, error(){}, errorw(){} };
function setup(t) { const db = new Database(':memory:'); runMigrationsAndEnsure(db);t.after(()=>db.close());return db; }
function ready(db, input={}) {const s=director.create(db,{instruction:'女孩发现电梯停在不存在的楼层',...input});return director.update(db,s.id,{use_defaults:true});}
test('asks only missing questions and explicit preferences survive defaults', t=>{
 const db=setup(t);const s=director.create(db,{instruction:'做一个动态漫画，悬疑反转'});
 assert.deepEqual(s.questions.map(q=>q.key),['ending']);
 const next=director.update(db,s.id,{use_defaults:true});assert.equal(next.brief.visual_style,'动态漫画');assert.equal(next.questions.length,0);assert.equal(next.brief.dry_run,true);
});
test('Mock plans and starts once; edits invalidate plan, revisions block stale confirmation',async t=>{
 const db=setup(t);let s=ready(db);s=await director.plan(db,log,s.id);
 assert.equal(s.planning_calls,0);assert.equal(s.plan.director.source,'mock');
 const revised=director.update(db,s.id,{notes:'不要恐怖血腥'});assert.equal(revised.plan,null);
 assert.throws(()=>director.start(db,{},log,s.id,s.revision),/先生成/);
 await director.plan(db,log,s.id);assert.throws(()=>director.start(db,{},log,s.id,s.revision),/最新版本/);
 const run=director.start(db,{},log,s.id,revised.revision);
 assert.equal(run.status,'SCRIPT_REVIEW');assert.equal(director.start(db,{},log,s.id,revised.revision).id,run.id);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM agent_runs').get().n,1);
 assert.throws(()=>director.update(db,s.id,{notes:'x'}),/不能修改/);
});
test('AI plan preserves user constraints, ignores model cost/mode, and caches paid calls',async t=>{
 const db=setup(t);const original=ai.generateText;let calls=0;
 ai.generateText=async (...args)=>{calls++;assert.equal(args[5].max_tokens,1800);assert.match(args[3],/不要血腥/);return JSON.stringify({title:'十三层',logline:'女孩用门牌识破幻象',beats:['女孩进电梯','门牌揭示陷阱','女孩按下开门逃出'],characters:[{name:'林晚',visual_anchor:'短发黄外套'}],dry_run:true,budget_limit:99999});};t.after(()=>{ai.generateText=original;});
 const s=ready(db,{dry_run:false,notes:'不要血腥',budget_limit:50});const p=await director.plan(db,log,s.id);await director.plan(db,log,s.id);
 assert.equal(calls,1);assert.equal(p.plan.dry_run,false);assert.equal(p.plan.estimated.budget_limit,50);assert.equal(p.plan.project.episode_count,1);assert.equal(p.plan.project.title,'十三层');assert.match(p.plan.logline,/不要血腥/);assert.match(p.plan.logline,/林晚.*短发黄外套/);
});
test('bad provider output retains draft, makes no automatic retry, allows safe recovery',async t=>{
 const db=setup(t);const original=ai.generateText;let calls=0;ai.generateText=async()=>{calls++;return '{"title":"缺失内容"}';};t.after(()=>{ai.generateText=original;});
 const s=ready(db,{dry_run:false});await assert.rejects(director.plan(db,log,s.id),/缺少完整/);assert.equal(calls,1);assert.equal(director.get(db,s.id).status,'DRAFT');
 db.prepare("UPDATE director_sessions SET status='PLANNING' WHERE id=?").run(s.id);await assert.rejects(director.plan(db,log,s.id),/正在策划/);
 director.recover(db);assert.equal(director.get(db,s.id).status,'DRAFT');
});
test('budget and missing answers are enforced before production',async t=>{
 const db=setup(t);assert.throws(()=>director.create(db,{instruction:'故事',budget_limit:'NaN'}),/预算/);
 let s=director.create(db,{instruction:'故事',budget_limit:10});await assert.rejects(director.plan(db,log,s.id),/关键问题/);
 director.update(db,s.id,{use_defaults:true});s=await director.plan(db,log,s.id);assert.throws(()=>director.start(db,{},log,s.id,s.revision),/预算/);assert.equal(director.get(db,s.id).run_id,null);
});
