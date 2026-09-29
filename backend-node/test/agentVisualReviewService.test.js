const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const sharp=require('sharp'),Database=require('better-sqlite3');
const {runMigrationsAndEnsure}=require('../src/db/migrate');
const wb=require('../src/services/agentWorkbenchService');
const service=require('../src/services/agentVisualReviewService');
const log={info(){},warn(){},error(){}};
async function fixture(){
 const db=new Database(':memory:');runMigrationsAndEnsure(db);
 let run=wb.createRun(db,log,{instruction:'主管抢主角通知书',episode_count:1,episode_duration_seconds:30,budget_limit:100,dry_run:true});
 for(let i=0;i<2;i++)run=wb.approve(db,run.approvals.find(a=>a.status==='PENDING').id,'approve');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'visual-review-'));
 for(const [name,color] of [['original','red'],['ref','blue'],['fix1','green'],['fix2','yellow']]) await sharp({create:{width:32,height:32,channels:3,background:color}}).png().toFile(path.join(root,name+'.png'));
 const shot=db.prepare('SELECT id FROM storyboards ORDER BY id LIMIT 1').get().id;
 const character=db.prepare('SELECT id FROM characters ORDER BY id LIMIT 1').get().id;
 db.prepare("UPDATE characters SET local_path='ref.png' WHERE id=?").run(character);
 db.prepare("UPDATE storyboards SET characters=?,scene_id=NULL,local_path='original.png' WHERE id=?").run(JSON.stringify([character]),shot);
 db.prepare('DELETE FROM storyboard_props WHERE storyboard_id=?').run(shot);
 return {db,run,shot,root,cfg:{storage:{local_path:root}},close(){db.close();fs.rmSync(root,{recursive:true,force:true});}};
}
function verdict(decision='REVISE') {return {decision,checks:service.CRITERIA.map(c=>({criterion:c,status:decision==='PASS'?'PASS':decision==='UNCERTAIN'?'UNCERTAIN':'FAIL',evidence:'图1左侧蓝色衬衫与角色参考不符'})),findings:decision==='PASS'?[]:[{location:'图1左侧',evidence:'蓝衬衫人物拿着主管文件',requirement:'主角应穿黑西装',fix:'保持构图，只修正主角服装与文件归属'}]};}
const candidate=n=>({local_path:`fix${n}.png`,image_url:`/static/fix${n}.png`});
test('actual target/reference bytes, two repairs then human, retry never replenishes calls',async()=>{
 const f=await fixture();try{let n=0;const options={review:async(input,images)=>{assert.equal(images.length,2);assert.match(images[0].imageUrl,/^data:image\/png;base64,/);assert.notEqual(images[0].imageUrl,images[1].imageUrl);assert.equal(input.evidence.length,2);return verdict();},repair:async()=>candidate(++n)};
 const result=await service.runImageReview(f.db,f.cfg,log,f.run,f.shot,options);
 assert.equal(result.status,'HUMAN_REVIEW');assert.equal(result.calls,5);assert.equal(result.versions.length,3);assert.equal(result.reviews.length,3);assert.equal(n,2);
 assert.equal(f.db.prepare('SELECT local_path FROM storyboards WHERE id=?').get(f.shot).local_path,'original.png');
 const repeat=await service.runImageReview(f.db,f.cfg,log,f.run,f.shot,options);assert.equal(repeat.calls,5);assert.equal(n,2);
 }finally{f.close();}
});
test('only passed repaired version replaces active shot; evidence and original survive',async()=>{
 const f=await fixture();try{let n=0;const result=await service.runImageReview(f.db,f.cfg,log,f.run,f.shot,{review:async()=>verdict(n++?'PASS':'REVISE'),repair:async()=>candidate(1)});
 assert.equal(result.status,'PASSED');assert.equal(result.calls,3);assert.equal(result.versions[0].image.local_path,'original.png');assert.equal(f.db.prepare('SELECT local_path FROM storyboards WHERE id=?').get(f.shot).local_path,'fix1.png');assert.ok(fs.existsSync(path.join(f.root,'original.png')));
 }finally{f.close();}
});
test('uncertain and invalid reviews stop without repair',async()=>{
 for(const response of [verdict('UNCERTAIN'),{decision:'PASS',checks:[],findings:[]}]){const f=await fixture();try{const r=await service.runImageReview(f.db,f.cfg,log,f.run,f.shot,{review:async()=>response,repair:async()=>{throw new Error('must not repair');}});assert.equal(r.status,'HUMAN_REVIEW');assert.equal(r.calls,1);}finally{f.close();}}
});
test('same-path reference edits during call invalidate result; manual edit never overwritten',async()=>{
 const f=await fixture();try{const r=await service.runImageReview(f.db,f.cfg,log,f.run,f.shot,{review:async()=>{fs.copyFileSync(path.join(f.root,'fix1.png'),path.join(f.root,'ref.png'));return verdict('PASS');}});assert.equal(r.status,'HUMAN_REVIEW');assert.match(r.reason,/发生变化/);assert.equal(r.reviews.length,0);}finally{f.close();}
 const g=await fixture();try{const r=await service.runImageReview(g.db,g.cfg,log,g.run,g.shot,{review:async()=>verdict(),repair:async()=>{g.db.prepare("UPDATE storyboards SET local_path='fix2.png' WHERE id=?").run(g.shot);return candidate(1);}});assert.equal(r.status,'HUMAN_REVIEW');assert.match(r.reason,/发生变化/);assert.equal(g.db.prepare('SELECT local_path FROM storyboards WHERE id=?').get(g.shot).local_path,'fix2.png');}finally{g.close();}
});
test('unchanged candidate, provider error, cancellation do not retry',async()=>{
 for(const kind of ['same','error','cancel']){const f=await fixture();try{const r=await service.runImageReview(f.db,f.cfg,log,f.run,f.shot,{review:async()=>{if(kind==='error')throw Error('HTTP400 test-only');if(kind==='cancel')f.db.prepare("UPDATE agent_runs SET status='CANCELLED' WHERE id=?").run(f.run.id);return verdict();},repair:async()=>({local_path:'original.png'})});assert.equal(r.status,'HUMAN_REVIEW');assert.equal(r.calls,kind==='same'?2:1);}finally{f.close();}}
});
test('Mock, missing vision config, missing references and budget fail closed before calls',async()=>{
 for(const kind of ['mock','config','refs','budget']) {const f=await fixture();try{
  if(kind==='config'||kind==='budget')f.run.dry_run=false;
  if(kind==='refs')fs.unlinkSync(path.join(f.root,'ref.png'));
  if(kind==='budget')f.run.budget_limit=0;
  const options=['mock','config'].includes(kind)?{}:{review:async()=>verdict('PASS')};
  const r=await service.runImageReview(f.db,f.cfg,log,f.run,f.shot,options);assert.equal(r.status,'HUMAN_REVIEW');assert.equal(r.calls,0);
 }finally{f.close();}}
});
test('local image reader refuses traversal, symlinks and non-image data',async()=>{
 const f=await fixture();const outside=path.join(os.tmpdir(),`visual-secret-${Date.now()}.png`);try{fs.writeFileSync(outside,'private');fs.symlinkSync(outside,path.join(f.root,'escape.png'));fs.writeFileSync(path.join(f.root,'fake.png'),'not image');for(const name of [outside,'escape.png','fake.png'])await assert.rejects(service.readImage(f.root,{local_path:name},'target'));}finally{fs.rmSync(outside,{force:true});f.close();}
});
test('human image override requires recorded reason and preserves AI finding',async()=>{
 const f=await fixture();try{await service.runImageReview(f.db,f.cfg,log,f.run,f.shot,{review:async()=>verdict('UNCERTAIN')});
 // Refresh the initial Mock approval snapshot to this fixture's current image state.
 const a=f.run.approvals.find(a=>a.status==='PENDING');f.db.prepare('UPDATE approval_requests SET snapshot_json=? WHERE id=?').run(JSON.stringify(require('../src/services/agentImageGate').snapshot(f.db,f.run.project_id)),a.id);
 assert.throws(()=>wb.approve(f.db,a.id,'approve'),/判断依据/);
 const result=wb.approve(f.db,a.id,'approve','人工已核对服装');const cycle=result.review_cycles.find(c=>c.stage.startsWith('image:'));assert.equal(cycle.status,'HUMAN_ACCEPTED');assert.equal(cycle.reviews[0].decision,'UNCERTAIN');
 }finally{f.close();}
});
test('concurrent invocation is rejected and interrupted cycle is not replayed',async()=>{
 const f=await fixture();try{let release,entered;const started=new Promise(r=>entered=r);const pending=service.runImageReview(f.db,f.cfg,log,f.run,f.shot,{review:async()=>{entered();return new Promise(r=>release=r);}});await started;
 await assert.rejects(service.runImageReview(f.db,f.cfg,log,f.run,f.shot,{}),/正在运行/);release(verdict('PASS'));await pending;
 f.db.prepare("UPDATE agent_review_cycles SET status='RUNNING' WHERE run_id=?").run(f.run.id);const r=await service.runImageReview(f.db,f.cfg,log,f.run,f.shot,{review:()=>{throw Error('must not call');}});assert.equal(r.status,'HUMAN_REVIEW');assert.equal(r.calls,1);assert.match(r.reason,/中断/);
 }finally{f.close();}
});
test('production image phase reviews real input bytes and repairs detached before manual video gate',async()=>{
 const f=await fixture();const ai=require('../src/services/aiClient'),image=require('../src/services/imageService'),tasks=require('../src/services/taskService');
 const originals={vision:ai.generateTextWithVision,create:image.create,get:tasks.getTask};
 try{
  f.db.prepare('DELETE FROM storyboards WHERE id<>?').run(f.shot);
  f.db.prepare("UPDATE approval_requests SET status='REJECTED' WHERE run_id=? AND approval_stage='images'").run(f.run.id);
  f.db.prepare("UPDATE agent_runs SET dry_run=0,status='IMAGE_GENERATING' WHERE id=?").run(f.run.id);
  const configs=require('../src/services/aiConfigService');for(const type of ['image','vision_review']) configs.createConfig(f.db,log,{service_type:type,provider:'openai',name:'test-only',base_url:'https://example.invalid',api_key:'test-only',model:['mock-model'],default_model:'mock-model'});
  let reviews=0,repairs=0;
  ai.generateTextWithVision=async(_db,_log,type,_prompt,_system,images)=>{assert.equal(type,'vision_review');assert.equal(images.length,2);return JSON.stringify(verdict(reviews++?'PASS':'REVISE'));};
  image.create=(_db,_log,input)=>{
   if(input.storyboard_id)return {id:0,task_id:'mock-initial'};
   repairs++;assert.equal(input.scene_id,undefined);assert.deepEqual(input.reference_images,['original.png','ref.png']);assert.match(input.prompt,/主角服装/);
   const id=f.db.prepare("INSERT INTO image_generations(drama_id,status,local_path,image_url,prompt) VALUES(?,'completed','fix1.png','/static/fix1.png','mock-fixed')").run(f.run.project_id).lastInsertRowid;
   return {id,task_id:'mock-repair'};
  };
  tasks.getTask=()=>({status:'completed',result:'{}'});
  require('../src/services/agentProductionService').runAction(f.db,f.cfg,log,f.run.id,'images');
  let result;for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,10));result=wb.getRun(f.db,f.run.id);if(result.status!=='IMAGE_GENERATING')break;}
  assert.equal(result.status,'IMAGE_REVIEW');assert.equal(reviews,2);assert.equal(repairs,1);assert.equal(result.review_cycles[0].status,'PASSED');
  assert.equal(f.db.prepare('SELECT local_path FROM storyboards WHERE id=?').get(f.shot).local_path,'fix1.png');assert.equal(f.db.prepare('SELECT count(*) n FROM video_generations').get().n,0);
  image.create=()=>{throw Error('recovery must not regenerate');};
  f.db.prepare("UPDATE agent_runs SET status='IMAGE_GENERATING' WHERE id=?").run(f.run.id);
  require('../src/services/agentProductionService').runAction(f.db,f.cfg,log,f.run.id,'images');
  for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,10));result=wb.getRun(f.db,f.run.id);if(result.status!=='IMAGE_GENERATING')break;}
  assert.equal(result.status,'IMAGE_REVIEW');assert.equal(reviews,2);assert.equal(repairs,1);assert.equal(result.review_cycles[0].calls,3);

 }finally{ai.generateTextWithVision=originals.vision;image.create=originals.create;tasks.getTask=originals.get;f.close();}
});
