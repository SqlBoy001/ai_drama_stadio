const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runMigrationsAndEnsure } = require('../src/db/migrate');
const service = require('../src/services/agentReviewService');
const workbench = require('../src/services/agentWorkbenchService');
function setup() {
 const db = new Database(':memory:'); runMigrationsAndEnsure(db);
 const run = { id:'r', user_instruction:'悬疑，主角主动破局，有爽点与伏笔', plan:{project:{episode_count:1}}, dry_run:true, budget_limit:100, estimated_cost:10 };
 db.prepare("INSERT INTO agent_runs(id,user_instruction,plan_json,status,created_at,updated_at) VALUES ('r','direction','{}','SCRIPT_GENERATING','now','now')").run();
 return {db,run,episodes:[{episode_number:1,title:'test',script_content:'初稿内容'}]};
}
function review(decision) { return {decision,checks:service.CRITERIA.map(criterion=>({criterion,status:decision==='PASS'?'PASS':decision==='UNCERTAIN'?'UNCERTAIN':'FAIL',evidence:'第1场主角只听规则，没有主动选择'})),findings:decision==='REVISE'?[{location:'第1场',evidence:'只听解释',requirement:'主角主动选择',fix:'加入试探动作并改变处境'}]:[]}; }
test('two revisions then human; persist all versions; retry never spends again',async()=>{
 const {db,run,episodes}=setup();let calls=0;
 try { const invoke=async(role,input)=>{calls++;return role==='reviewer'?review('REVISE'):input.episodes.map(e=>({...e,script_content:e.script_content+'修正'}));};
 const result=await service.runScriptReview(db,{},run,episodes,{invoke});assert.equal(calls,5);assert.equal(result.status,'HUMAN_REVIEW');assert.equal(result.versions.length,3);assert.equal(result.reviews.length,3);assert.equal(result.versions[0].episodes[0].script_content,'初稿内容');
 await service.runScriptReview(db,{},run,episodes,{invoke});assert.equal(calls,5);
 } finally {db.close();}
});
test('pass after repair terminates; author receives findings while reviewer gets fresh context',async()=>{
 const {db,run,episodes}=setup();let n=0;
 try {const result=await service.runScriptReview(db,{},run,episodes,{invoke:async(role,input)=>{if(role==='writer'){assert.equal(input.findings[0].location,'第1场');return input.episodes.map(e=>({...e,script_content:'主角主动反击'}));}assert.equal(input.findings,undefined);return review(n++?'PASS':'REVISE');}});assert.equal(result.status,'PASSED');assert.equal(result.calls,3);}finally{db.close();}
});
test('uncertainty and malformed verdicts go directly to human',async()=>{
 for(const value of [review('UNCERTAIN'),{decision:'PASS',checks:[],findings:[]}]) {const {db,run,episodes}=setup();try {const r=await service.runScriptReview(db,{},run,episodes,{invoke:async()=>value});assert.equal(r.status,'HUMAN_REVIEW');assert.equal(r.calls,1);}finally{db.close();}}
});
test('budget reserve blocks external call; mock never invokes provider',async()=>{
 for(const real of [true,false]){const {db,run,episodes}=setup();run.dry_run=!real;run.budget_limit=10;try{const r=await service.runScriptReview(db,{},run,episodes);assert.equal(r.status,'HUMAN_REVIEW');assert.equal(r.calls,0);}finally{db.close();}}
});
test('cancel during response cannot pass; interrupted review never auto-retries',async()=>{
 const {db,run,episodes}=setup();try{const r=await service.runScriptReview(db,{},run,episodes,{invoke:async()=>{db.prepare("UPDATE agent_runs SET status='CANCELLED' WHERE id='r'").run();return review('PASS');}});assert.equal(r.status,'HUMAN_REVIEW');db.prepare("UPDATE agent_review_cycles SET status='RUNNING'").run();const again=await service.runScriptReview(db,{},run,episodes,{invoke:()=>assert.fail('no retry')});assert.equal(again.status,'HUMAN_REVIEW');}finally{db.close();}
});
test('human override requires a reason and retains audit evidence',async()=>{
 const {db,run,episodes}=setup();try{await service.runScriptReview(db,{},run,episodes);db.prepare("INSERT INTO approval_requests(id,run_id,target_type,approval_stage,status,created_at) VALUES ('a','r','script','script','PENDING','now')").run();assert.throws(()=>workbench.approve(db,'a','approve',''),/判断依据/);}finally{db.close();}
});
test('unchanged repair stops early without burning second revision',async()=>{
 const {db,run,episodes}=setup();try{const r=await service.runScriptReview(db,{},run,episodes,{invoke:async(role,input)=>role==='reviewer'?review('REVISE'):input.episodes});assert.equal(r.calls,2);assert.equal(r.status,'HUMAN_REVIEW');assert.equal(r.versions.length,1);}finally{db.close();}
});
test('simultaneous review cannot create another paid allowance',async()=>{
 const {db,run,episodes}=setup();let release;const gate=new Promise(r=>release=r);try{const first=service.runScriptReview(db,{},run,episodes,{invoke:async()=>{await gate;return review('PASS');}});await assert.rejects(service.runScriptReview(db,{},run,episodes,{invoke:()=>assert.fail()}),/正在执行/);release();assert.equal((await first).calls,1);}finally{db.close();}
});
test('production retry after handoff preserves manually edited episodes and never calls writer',async()=>{
 const db=new Database(':memory:');runMigrationsAndEnsure(db);const log={info(){},warn(){},error(){}};
 try {
  const run=workbench.createRun(db,log,{instruction:'悬疑试播',dry_run:true,episode_count:1,episode_duration_seconds:30,budget_limit:100});
  const eps=db.prepare('SELECT episode_number,title,script_content FROM episodes WHERE drama_id=?').all(run.project_id);
  await service.runScriptReview(db,log,run,eps);
  db.prepare("UPDATE episodes SET script_content='人工修改，必须保留' WHERE drama_id=?").run(run.project_id);
  db.prepare("UPDATE agent_runs SET dry_run=0,status='SCRIPT_GENERATING' WHERE id=?").run(run.id);
  require('../src/services/agentProductionService').runAction(db,{},log,run.id,'script');
  await new Promise(resolve=>setImmediate(()=>setImmediate(resolve)));
  assert.equal(db.prepare('SELECT script_content FROM episodes WHERE drama_id=?').get(run.project_id).script_content,'人工修改，必须保留');
  assert.equal(db.prepare('SELECT status FROM agent_runs WHERE id=?').get(run.id).status,'SCRIPT_REVIEW');
  assert.equal(service.list(db,run.id)[0].calls,0);
 }finally{db.close();}
});
