const test=require('node:test'),assert=require('node:assert/strict');
const Database=require('better-sqlite3');const {runMigrationsAndEnsure}=require('../src/db/migrate');
const wb=require('../src/services/agentWorkbenchService'),gate=require('../src/services/agentImageGate'),production=require('../src/services/agentProductionService');
const log={info(){},warn(){},error(){}};
function setup(){const db=new Database(':memory:');runMigrationsAndEnsure(db);let run=wb.createRun(db,log,{instruction:'1集测试',episode_count:1,episode_duration_seconds:30,budget_limit:100,dry_run:true});for(let i=0;i<2;i++)run=wb.approve(db,run.approvals.find(a=>a.status==='PENDING').id,'approve');return {db,run};}
test('assets approval stops at image review, with no video usage',()=>{const {db,run}=setup();try{assert.equal(run.status,'IMAGE_REVIEW');assert.equal(run.usage.length,0);assert.equal(run.approvals.find(a=>a.status==='PENDING').approval_stage,'images');}finally{db.close();}});
test('missing real images and stale upstream block approval',()=>{const {db,run}=setup();try{const a=run.approvals.find(a=>a.status==='PENDING');db.prepare('UPDATE agent_runs SET dry_run=0 WHERE id=?').run(run.id);assert.throws(()=>wb.approve(db,a.id,'approve'),/补齐/);db.prepare('UPDATE agent_runs SET dry_run=1 WHERE id=?').run(run.id);db.prepare("UPDATE storyboards SET image_prompt='changed' WHERE id=?").run(a.snapshot.shots[0].id);assert.throws(()=>wb.approve(db,a.id,'approve'),/重新审核/);assert.equal(wb.getRun(db,run.id).status,'IMAGE_REVIEW');}finally{db.close();}});
test('approved snapshot invalidated by image and script changes',()=>{const {db,run}=setup();try{const a=run.approvals.find(a=>a.status==='PENDING');db.prepare("UPDATE approval_requests SET status='APPROVED',resolved_at='now' WHERE id=?").run(a.id);assert.doesNotThrow(()=>gate.assertApproved(db,run));db.prepare("UPDATE episodes SET script_content='new script' WHERE drama_id=?").run(run.project_id);assert.throws(()=>gate.assertApproved(db,run),/重新审核/);}finally{db.close();}});
test('reject, locally change image, resume creates fresh gate without a generation job',()=>{const {db,run}=setup();try{const a=run.approvals.find(a=>a.status==='PENDING');wb.approve(db,a.id,'reject','修正第1镜人物');db.prepare("UPDATE storyboards SET local_path='revised.jpg' WHERE id=?").run(a.snapshot.shots[0].id);const resumed=wb.controlRun(db,run.id,'resume');assert.equal(resumed.status,'IMAGE_REVIEW');assert.notEqual(resumed.approvals.find(a=>a.status==='PENDING').snapshot.digest,a.snapshot.digest);assert.equal(resumed.usage.length,0);}finally{db.close();}});
test('direct video execution without image approval fails before paid submission',async()=>{const {db,run}=setup();try{db.prepare("UPDATE agent_runs SET dry_run=0,status='MEDIA_GENERATING' WHERE id=?").run(run.id);production.runAction(db,{},log,run.id,'media');await new Promise(resolve=>setImmediate(()=>setImmediate(resolve)));const result=wb.getRun(db,run.id);assert.equal(result.status,'FAILED');assert.match(result.steps.find(s=>s.step_key==='real_media_generated').error_message,/先审核通过/);assert.equal(db.prepare('SELECT count(*) n FROM video_generations').get().n,0);assert.equal(result.usage.length,0);}finally{db.close();}});
test('recover image generation after pause preserves image action',()=>{const {db,run}=setup();try{db.prepare("UPDATE agent_runs SET dry_run=0,status='IMAGE_GENERATING',current_step='resumed' WHERE id=?").run(run.id);production.recoverInterruptedRuns(db,log);assert.equal(wb.getRun(db,run.id).current_step,'failed:images');assert.equal(wb.controlRun(db,run.id,'retry').status,'IMAGE_GENERATING');}finally{db.close();}});
test('successful image phase persists checkpoint and does not create video or voice tasks',async()=>{
 const {db,run}=setup();const image=require('../src/services/imageService'),tasks=require('../src/services/taskService');const oldCreate=image.create,oldGet=tasks.getTask;
 try{
  require('../src/services/aiConfigService').createConfig(db,log,{service_type:'image',provider:'openai',name:'mock image transport',base_url:'https://example.invalid',api_key:'test-only',model:['test-image'],default_model:'test-image',is_default:true});
  db.prepare("UPDATE approval_requests SET status='REJECTED' WHERE run_id=? AND approval_stage='images'").run(run.id);
  db.prepare("UPDATE agent_runs SET dry_run=0,status='IMAGE_GENERATING' WHERE id=?").run(run.id);
  image.create=(_db,_log,input)=>{db.prepare('UPDATE storyboards SET local_path=? WHERE id=?').run(`mock/${input.storyboard_id}.png`,input.storyboard_id);return {task_id:'fixture'};};
  tasks.getTask=()=>({status:'completed',result:'{}'});
  production.runAction(db,{},log,run.id,'images');await new Promise(resolve=>setImmediate(()=>setImmediate(resolve)));
  const result=wb.getRun(db,run.id);assert.equal(result.status,'IMAGE_REVIEW');assert.equal(result.approvals.find(a=>a.status==='PENDING').snapshot.images_completed,6);
  assert.equal(db.prepare('SELECT count(*) n FROM video_generations').get().n,0);assert.ok(result.usage.every(u=>u.operation==='storyboard_image'));
 }finally{image.create=oldCreate;tasks.getTask=oldGet;db.close();}
});
test('real image approval pins file bytes, rejects same-path replacement, deletion and legacy snapshots',()=>{
 const {db,run}=setup();const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const root=fs.mkdtempSync(path.join(os.tmpdir(),'image-gate-bytes-'));const cfg={storage:{local_path:root}};
 try{
  fs.writeFileSync(path.join(root,'shot.png'),'verified fixture bytes');
  db.prepare("UPDATE storyboards SET local_path='shot.png',image_url=NULL").run();
  run.dry_run=false;
  const snapshot=gate.snapshot(db,run.project_id,cfg);
  assert.doesNotThrow(()=>gate.assertReady(db,run,snapshot,cfg));
  const old={...snapshot};delete old.file_digest;assert.throws(()=>gate.assertReady(db,run,old,cfg),/旧审核/);
  fs.writeFileSync(path.join(root,'shot.png'),'replaced fixture bytes');assert.throws(()=>gate.assertReady(db,run,snapshot,cfg),/文件内容已变化/);
  fs.unlinkSync(path.join(root,'shot.png'));assert.throws(()=>gate.assertReady(db,run,snapshot,cfg),/不存在/);
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
});
