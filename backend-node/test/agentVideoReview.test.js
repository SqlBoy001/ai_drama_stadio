const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Database=require('better-sqlite3'),sharp=require('sharp');
const {runMigrationsAndEnsure}=require('../src/db/migrate');
const wb=require('../src/services/agentWorkbenchService'),inspect=require('../src/services/agentVideoInspection'),review=require('../src/services/agentVideoReviewService'),gate=require('../src/services/agentImageGate');
const {getFfmpegPath}=require('../src/utils/ffmpegPath');
const cfgModule=require('../src/config');const log={info(){},warn(){},error(){}};
let mediaRoot;
test.before(async()=>{
 mediaRoot=fs.mkdtempSync(path.join(os.tmpdir(),'video-review-fixtures-'));
 for(const [i,color] of ['red','blue','green'].entries()) await inspect.command(getFfmpegPath(),['-v','error','-f','lavfi','-i',`color=c=${color}:s=720x1280:r=12:d=1`,'-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',path.join(mediaRoot,`clip${i}.mp4`)]);
 await sharp({create:{width:32,height:32,channels:3,background:'red'}}).png().toFile(path.join(mediaRoot,'ref.png'));
});
test.after(()=>fs.rmSync(mediaRoot,{recursive:true,force:true}));
function fixture(){
 const db=new Database(':memory:');runMigrationsAndEnsure(db);const root=fs.mkdtempSync(path.join(os.tmpdir(),'video-review-'));
 for(const name of ['clip0.mp4','clip1.mp4','clip2.mp4','ref.png'])fs.copyFileSync(path.join(mediaRoot,name),path.join(root,name));
 const cfg={storage:{local_path:root}},previous=cfgModule.loadConfig;cfgModule.loadConfig=()=>cfg;
 let run=wb.createRun(db,log,{instruction:'Mock视频审核测试',episode_count:1,episode_duration_seconds:30,budget_limit:300,dry_run:true});for(let i=0;i<2;i++)run=wb.approve(db,run.approvals.find(a=>a.status==='PENDING').id,'approve');
 const id=db.prepare('SELECT id FROM storyboards LIMIT 1').get().id;
 db.prepare('DELETE FROM storyboards WHERE id<>?').run(id);
 db.prepare("UPDATE storyboards SET video_url='clip0.mp4',local_path='ref.png',duration=1,dialogue='',narration='',characters='[]',scene_id=NULL,location='门口',angle='平视',result='手保持不动',lighting_style='soft' WHERE id=?").run(id);
 const shot={...db.prepare('SELECT * FROM storyboards WHERE id=?').get(id),aspect_ratio:'9:16'};
 const a=run.approvals.find(x=>x.status==='PENDING');db.prepare("UPDATE approval_requests SET status='APPROVED',snapshot_json=?,resolved_at='now' WHERE id=?").run(JSON.stringify(gate.snapshot(db,run.project_id,cfg)),a.id);
 return {db,run,root,cfg,shot,close(){cfgModule.loadConfig=previous;db.close();fs.rmSync(root,{recursive:true,force:true});}};
}
const verdict=(decision='REVISE')=>({decision,checks:review.CRITERIA.map(criterion=>({criterion,status:decision==='PASS'?'PASS':decision==='UNCERTAIN'?'UNCERTAIN':'FAIL',evidence:'Mock注入：0.4秒左侧动作不符'})),findings:decision==='PASS'?[]:[{location:'0.4秒左侧',evidence:'Mock注入：文件递给错误角色',requirement:'交给主角',fix:'只修复递交动作和归属'}]});
test('actual probe, full decode and six timestamped frames; no semantic PASS',async()=>{
 const f=fixture();try{const r=await inspect.inspect(f.cfg,{local_path:'clip0.mp4'},f.shot);assert.equal(r.status,'TECHNICAL_PASS',JSON.stringify(r));assert.equal(r.width,720);assert.equal(r.height,1280);assert.equal(r.frames.length,6);assert.equal(r.audio_present,true);assert.equal(r.audio_status,'NOT_REVIEWED');assert.ok(r.frames.every(x=>x.sha256&&fs.existsSync(path.join(f.root,x.path))));
 const bad=await inspect.inspect(f.cfg,{local_path:'clip0.mp4'},{...f.shot,duration:5,aspect_ratio:'16:9'},{extractFrames:false});assert.equal(bad.status,'BLOCKED');assert.equal(bad.checks.find(c=>c.key==='duration').passed,false);
 fs.writeFileSync(path.join(f.root,'broken.mp4'),'not a video');assert.equal((await inspect.inspect(f.cfg,{local_path:'broken.mp4'},f.shot)).status,'BLOCKED');
 }finally{f.close();}
});
test('video reviewer sees real frame bytes, two failed repairs preserve original and exhausted allowance',async()=>{
 const f=fixture();try{let repairs=0;const opts={review:async(input,images)=>{assert.equal(images.length,7);assert.equal(input.frames.length,6);assert.match(images[1].imageUrl,/^data:image\/jpeg;base64,/);return verdict();},repair:async()=>({local_path:`clip${++repairs}.mp4`})};
 const r=await review.review(f.db,f.cfg,log,f.run,f.shot,opts);assert.equal(r.calls,5);assert.equal(r.versions.length,3);assert.equal(r.status,'HUMAN_REVIEW');assert.match(r.reason,/两次/);assert.equal(f.db.prepare('SELECT video_url FROM storyboards WHERE id=?').get(f.shot.id).video_url,'clip0.mp4');
 await review.review(f.db,f.cfg,log,f.run,f.shot,opts);assert.equal(repairs,2);
 }finally{f.close();}
});
test('visual pass after repair binds candidate but always requires audio/full-motion human review',async()=>{
 const f=fixture();try{let n=0;const r=await review.review(f.db,f.cfg,log,f.run,f.shot,{review:async()=>verdict(n++?'PASS':'REVISE'),repair:async()=>({local_path:'clip1.mp4'})});assert.equal(r.calls,3);assert.equal(r.status,'HUMAN_REVIEW');assert.match(r.reason,/音频/);assert.equal(f.db.prepare('SELECT video_url FROM storyboards WHERE id=?').get(f.shot.id).video_url,'clip1.mp4');}finally{f.close();}
});
test('manual video edit during review invalidates conclusion and is preserved',async()=>{
 const f=fixture();try{const r=await review.review(f.db,f.cfg,log,f.run,f.shot,{review:async()=>{f.db.prepare("UPDATE storyboards SET video_url='clip2.mp4' WHERE id=?").run(f.shot.id);return verdict('PASS');}});assert.equal(r.status,'HUMAN_REVIEW');assert.match(r.reason,/版本变化/);assert.equal(r.reviews.length,0);}finally{f.close();}
});
test('remote provider URL resolves only its matching completed local video; final gate pins bytes',async()=>{
 const f=fixture();try{f.run.dry_run=false;f.db.prepare("UPDATE video_generations SET deleted_at='x'").run();f.db.prepare("INSERT INTO video_generations(drama_id,storyboard_id,status,video_url,local_path) VALUES(?,?,'completed','https://example.invalid/video','clip0.mp4')").run(f.run.project_id,f.shot.id);f.db.prepare("UPDATE storyboards SET video_url='https://example.invalid/video' WHERE id=?").run(f.shot.id);
 const report=await inspect.inspect(f.cfg,{local_path:'clip0.mp4'},f.shot,{extractFrames:false});const snapshot=inspect.snapshot(f.db,f.run,f.cfg);assert.equal(snapshot.shots[0].selected_local_path,'clip0.mp4');
 const approval={media_digest:snapshot.digest,inspections:[{shot_id:f.shot.id,report}]};assert.doesNotThrow(()=>inspect.assertReady(f.db,f.run,approval,f.cfg));
 fs.copyFileSync(path.join(f.root,'clip2.mp4'),path.join(f.root,'clip0.mp4'));assert.throws(()=>inspect.assertReady(f.db,f.run,approval,f.cfg),/版本已变化/);
 }finally{f.close();}
});
test('technical failures cannot be manually overridden and rejection resumes inspection, not paid generation',async()=>{
 const f=fixture();try{f.db.prepare("UPDATE agent_runs SET dry_run=0,status='FINAL_REVIEW' WHERE id=?").run(f.run.id);f.run.dry_run=false;
 const snapshot={media_digest:inspect.snapshot(f.db,f.run,f.cfg).digest,inspections:[{shot_id:f.shot.id,report:{status:'BLOCKED'}}],videos_completed:1};const id='final-fixture';
 f.db.prepare("INSERT INTO approval_requests(id,run_id,project_id,target_type,target_id,approval_stage,snapshot_json,status,created_at) VALUES(?,?,?,'video','1','final_video',?,'PENDING','now')").run(id,f.run.id,f.run.project_id,JSON.stringify(snapshot));
 assert.throws(()=>wb.approve(f.db,id,'approve','强行通过'),/技术检查未全部通过/);wb.approve(f.db,id,'reject','只修第1镜');assert.equal(wb.controlRun(f.db,f.run.id,'resume').status,'MEDIA_REVIEWING');assert.equal(f.db.prepare('SELECT count(*) n FROM video_generations').get().n,0);
 }finally{f.close();}
});
test('missing vision configuration gives real technical evidence and zero provider calls',async()=>{
 const f=fixture();try{f.run.dry_run=false;const r=await review.review(f.db,f.cfg,log,f.run,f.shot);assert.equal(r.calls,0);assert.equal(r.versions[0].inspection.status,'TECHNICAL_PASS');assert.match(r.reason,/未配置视觉审核/);}finally{f.close();}
});

test('invalid separate voice file is a technical block, not silently ignored',async()=>{
 const f=fixture();try{fs.writeFileSync(path.join(f.root,'voice.mp3'),'broken audio');const r=await inspect.inspect(f.cfg,{local_path:'clip0.mp4'},{...f.shot,audio_local_path:'voice.mp3'},{extractFrames:false});assert.equal(r.status,'BLOCKED');}finally{f.close();}
});
test('real local media review → reasoned approval → pinned merge → inspected export, no credentials',async()=>{
 const f=fixture();try{
  const production=require('../src/services/agentProductionService');
  f.db.prepare("UPDATE agent_runs SET dry_run=0,status='MEDIA_REVIEWING' WHERE id=?").run(f.run.id);
  const wait=async expected=>{let run;for(let i=0;i<500;i++){await new Promise(r=>setTimeout(r,20));run=wb.getRun(f.db,f.run.id);if(run.status===expected||run.status==='FAILED')break;}assert.equal(run.status,expected,JSON.stringify(run.steps.filter(s=>s.error_message)));return run;};
  production.runAction(f.db,f.cfg,log,f.run.id,'media_review');let run=await wait('FINAL_REVIEW');
  assert.equal(run.qc_reports[0].decision,'HUMAN_REVIEW');assert.equal(run.review_cycles[0].calls,0);
  const approval=run.approvals.find(a=>a.status==='PENDING');assert.throws(()=>wb.approve(f.db,approval.id,'approve'),/人工核对/);
  run=wb.approve(f.db,approval.id,'approve','Mock色块与提示音，仅验收本地合成流程');assert.equal(run.status,'EXPORTING');
  f.db.prepare("INSERT INTO video_generations(drama_id,storyboard_id,status,local_path,video_url,created_at,completed_at) VALUES(?,?,'completed','clip2.mp4','clip2.mp4','2999-01-01','2999-01-01')").run(run.project_id,f.shot.id);
  production.runAction(f.db,f.cfg,log,run.id,'export');run=await wait('EXPORTED');
  const output=run.steps.find(s=>s.step_key==='real_export_ready').output.episodes[0];assert.equal(output.inspection.status,'TECHNICAL_PASS');assert.ok(fs.existsSync(path.join(f.root,output.path)));
  const merged=f.db.prepare('SELECT scenes FROM video_merges WHERE id=?').get(output.merge_id);assert.match(JSON.parse(merged.scenes)[0].video_url,/clip0.mp4$/);assert.equal(run.usage.length,0);
 }finally{f.close();}
});
test('production submits 720p by default and stops at real video review with a mocked provider',async()=>{
 const f=fixture();const video=require('../src/services/videoService'),original=video.processVideoGeneration;try{
  const tasks=require('../src/services/taskService');let submissions=0;
  video.processVideoGeneration=async(db,_log,id)=>{const row=db.prepare('SELECT * FROM video_generations WHERE id=?').get(id);assert.equal(row.resolution,'720p');submissions++;db.prepare("UPDATE video_generations SET status='completed',video_url='clip0.mp4',local_path='clip0.mp4' WHERE id=?").run(id);tasks.updateTaskResult(db,row.task_id,{status:'completed'});};
  f.db.prepare("UPDATE agent_runs SET dry_run=0,status='MEDIA_GENERATING' WHERE id=?").run(f.run.id);
  require('../src/services/agentProductionService').runAction(f.db,f.cfg,log,f.run.id,'media');
  let result;for(let i=0;i<500;i++){await new Promise(r=>setTimeout(r,20));result=wb.getRun(f.db,f.run.id);if(['FINAL_REVIEW','FAILED'].includes(result.status))break;}
  assert.equal(result.status,'FINAL_REVIEW',JSON.stringify(result.steps.filter(s=>s.error_message)));assert.equal(submissions,1);assert.equal(result.approvals.find(a=>a.status==='PENDING').snapshot.inspections[0].report.status,'TECHNICAL_PASS');
 }finally{video.processVideoGeneration=original;f.close();}
});

test('editing handoff pins approved source files, separates audio and never implies ChatCut connected',()=>{
 const f=fixture();try{
 const handoff=require('../src/services/editingHandoffService');
 assert.throws(()=>handoff.build(f.db,f.cfg,f.run.id),/Mock/);
 f.db.prepare("UPDATE agent_runs SET dry_run=0,status='EXPORTED' WHERE id=?").run(f.run.id);
 assert.throws(()=>handoff.build(f.db,f.cfg,f.run.id),/审核/);
 const source=inspect.snapshot(f.db,{...f.run,dry_run:false},f.cfg);
 f.db.prepare("INSERT INTO approval_requests (id,run_id,target_type,approval_stage,status,snapshot_json,resolved_at,created_at) VALUES (?,?, 'episode','final_video','APPROVED',?,'now','now')").run('editing-final',f.run.id,JSON.stringify({media_digest:source.digest,inspections:[{shot_id:f.shot.id,report:{status:'TECHNICAL_PASS'}}]}));
 const a=handoff.build(f.db,f.cfg,f.run.id),b=handoff.build(f.db,f.cfg,f.run.id);
 assert.equal(a.handoff_digest,b.handoff_digest);assert.equal(a.connection_status,'NOT_VERIFIED');assert.equal(a.policy.new_generation_budget_cny,0);
 assert.equal(a.assets[0].local_path,fs.realpathSync(path.join(f.root,'clip0.mp4')));assert.equal(a.assets[0].sha256,source.files[0].sha256);
 assert.equal(a.timelines[0].clips[0].source_out,1);assert.equal(a.timelines[0].clips[0].original_audio,'preserve_for_review');
 const plan=require('../src/services/chatcutImportPlan').build(f.db,f.cfg,f.run.id);
 assert.equal(plan.handoff_digest,a.handoff_digest);assert.deepEqual(plan.imports.map(x=>x.sha256),a.assets.map(x=>x.sha256));
 assert.equal(plan.status,'AWAITING_DESKTOP_BINDING');
 fs.appendFileSync(path.join(f.root,'clip0.mp4'),'changed');assert.throws(()=>handoff.build(f.db,f.cfg,f.run.id),/变化/);
 assert.throws(()=>require('../src/services/chatcutImportPlan').build(f.db,f.cfg,f.run.id),/变化/);
 }finally{f.close();}
});

function approveForChatcut(f) {
 f.db.prepare("UPDATE agent_runs SET dry_run=0,status='EXPORTED' WHERE id=?").run(f.run.id);
 const snapshot=inspect.snapshot(f.db,{...f.run,dry_run:false},f.cfg);
 f.db.prepare("INSERT INTO approval_requests(id,run_id,target_type,approval_stage,status,snapshot_json,resolved_at,created_at) VALUES(?,?,'episode','final_video','APPROVED',?,'now','now')")
  .run('chatcut-approved',f.run.id,JSON.stringify({media_digest:snapshot.digest,inspections:[{shot_id:f.shot.id,report:{status:'TECHNICAL_PASS'}}]}));
}
function desktopFixture() {
 const state={pushes:0,project:'desktop-project',id:'12345678-1234-4321-8765-123456789abc',failPush:false,afterPush:null};
 state.callTool=async(name,args)=>{
  let value;
  if(name==='get_active_project')value={projectId:state.project};
  else if(name==='get_guidelines')value={operations:[{name:'push_asset'},{name:'inspect_asset'}]};
  else if(name==='execute' && args.name==='push_asset'){
   state.pushes++;assert.equal(args.arguments.filePath.length,1);assert.match(args.arguments.filePath[0],/clip0.mp4$/);
   if(state.failPush)throw new Error('connection lost after request');
   if(state.afterPush)state.afterPush();
   value={failed:0,succeeded:1,results:[{success:true,assetId:state.id,type:'video'}]};
  } else if(name==='execute' && args.name==='inspect_asset')value={asset:{id:'1234567812',type:'video'}};
  else throw new Error('Unexpected tool call');
  return {structuredContent:value};
 };
 return state;
}
test('ChatCut importer persists exact source mapping and resumes without another push',async()=>{
 const f=fixture();try{
  approveForChatcut(f);const client=desktopFixture(),importer=require('../src/services/chatcutAssetImporter');
  const first=await importer.importAssets(f.db,f.cfg,f.run.id,'desktop-project',client);
  const second=await importer.importAssets(f.db,f.cfg,f.run.id,'desktop-project',client);
  assert.deepEqual(first,second);assert.equal(client.pushes,1);assert.equal(first.desktop_connection_verified,true);
  assert.equal(first.content_review_required,true);assert.equal(f.db.prepare('SELECT status FROM chatcut_asset_imports').get().status,'IMPORTED');
  assert.equal(wb.getRun(f.db,f.run.id).status,'EXPORTED'); // Existing status was not changed by import.
 }finally{f.close();}
});
test('ChatCut uncertain remote result survives retries without duplicate import',async()=>{
 const f=fixture();try{
  approveForChatcut(f);const client=desktopFixture();client.failPush=true;const importer=require('../src/services/chatcutAssetImporter');
  await assert.rejects(importer.importAssets(f.db,f.cfg,f.run.id,'desktop-project',client),/connection lost/);
  client.failPush=false;
  await assert.rejects(importer.importAssets(f.db,f.cfg,f.run.id,'desktop-project',client),/禁止自动重试/);
  assert.equal(client.pushes,1);assert.equal(f.db.prepare('SELECT status FROM chatcut_asset_imports').get().status,'UNKNOWN');
 }finally{f.close();}
});
test('ChatCut wrong project blocks mutation; source edit during import cannot become imported',async()=>{
 const f=fixture();try{
  approveForChatcut(f);const client=desktopFixture(),importer=require('../src/services/chatcutAssetImporter');client.project='other';
  await assert.rejects(importer.importAssets(f.db,f.cfg,f.run.id,'desktop-project',client),/工程不一致/);assert.equal(client.pushes,0);
  client.project='desktop-project';client.afterPush=()=>fs.appendFileSync(path.join(f.root,'clip0.mp4'),'changed');
  await assert.rejects(importer.importAssets(f.db,f.cfg,f.run.id,'desktop-project',client),/变化/);
  assert.equal(f.db.prepare('SELECT status FROM chatcut_asset_imports').get().status,'UNKNOWN');
 }finally{f.close();}
});

function editingDesktopFixture(f) {
 const c=desktopFixture();c.created=0;c.items=[];c.tracks=[];c.exports=0;c.timeline='abcdefab-1234-4321-8765-123456789abc';
 const original=c.callTool;
 c.callTool=async(name,args)=>{
  if(name==='get_guidelines')return {structuredContent:{operations:['push_asset','inspect_asset','manage_timelines','edit_track','edit_item','preview_timeline','inspect_item','read_project','local_export'].map(name=>({name}))}};
  if(name!=='execute' || ['push_asset','inspect_asset'].includes(args.name))return original(name,args);
  const op=args.name,a=args.arguments;let result;
  if(op==='manage_timelines') {if(a.action==='create'){c.created++;c.name=a.name;}result={};}
  else if(op==='read_project')result={activeTimeline:{id:c.timeline},timelines:[{id:c.timeline,name:c.name}]};
  else if(op==='edit_track'){const t=JSON.parse(a.json);c.tracks.push({id:`track-${c.tracks.length}`,name:t.name,trackType:t.trackType});result={};}
  else if(op==='edit_item'){if(!a.validateOnly)c.items=a.adds.map((item,i)=>({...item,id:`item-${i}`}));result={};}
  else if(op==='preview_timeline')result={state:{id:c.timeline,fps:30,canvas:{width:720,height:1280},durationFrames:c.items.length?30:0},timeline:{tracks:c.tracks,totalEntries:c.items.length,entries:c.items.map(i=>({kind:'item',id:i.id,asset:{id:i.assetId},trackId:i.trackId,startFrame:i.startFrame,timelineRange:{toFrame:i.startFrame+i.durationFrames}}))}};
  else if(op==='inspect_item')result={item:{item:c.items.find(i=>i.id===a.itemId)}};
  else if(op==='local_export'){c.exports++;result={taskId:'task',outputPath:path.join(f.root,a.outputPath)};}
  else throw new Error('Unexpected editing operation '+op);
  return {structuredContent:result};
 };
 return c;
}
test('automated timeline and export are idempotent; queue alone cannot mark content ready',async()=>{
 const f=fixture();try{
  approveForChatcut(f);const c=editingDesktopFixture(f),edit=require('../src/services/chatcutEditingService');
  let jobs=await edit.prepare(f.db,f.cfg,f.run.id,'desktop-project',{client:c});assert.equal(jobs[0].status,'READY');
  await edit.prepare(f.db,f.cfg,f.run.id,'desktop-project',{client:c});assert.equal(c.created,1);assert.equal(c.pushes,1);
  await edit.exportJob(f.db,f.cfg,f.run.id,jobs[0].id,{client:c,exportRoot:f.root});
  jobs=await edit.exportJob(f.db,f.cfg,f.run.id,jobs[0].id,{client:c,exportRoot:f.root});assert.equal(c.exports,1);assert.equal(jobs[0].status,'EXPORT_QUEUED');
  jobs=await edit.collectExport(f.db,f.cfg,f.run.id,jobs[0].id,{client:c});assert.equal(jobs[0].status,'EXPORT_QUEUED');assert.equal(jobs[0].output,null);
  fs.copyFileSync(path.join(f.root,'clip0.mp4'),jobs[0].export_path);fs.utimesSync(jobs[0].export_path,new Date(0),new Date(0));
  jobs=await edit.collectExport(f.db,f.cfg,f.run.id,jobs[0].id,{client:c});assert.equal(jobs[0].status,'REVIEW_REQUIRED');assert.equal(jobs[0].output.inspection.status,'TECHNICAL_PASS');
  assert.equal(jobs[0].output.content_status,'REQUIRES_REVIEW');
  await assert.rejects(edit.approveExport(f.db,f.cfg,f.run.id,jobs[0].id,'',{client:c}),/审核依据/);
  jobs=await edit.approveExport(f.db,f.cfg,f.run.id,jobs[0].id,'仅验收测试色块与提示音，不代表真实剧情质量',{client:c});
  assert.equal(jobs[0].status,'APPROVED');assert.equal(jobs[0].output.review.sha256,jobs[0].output.sha256);
  fs.appendFileSync(path.join(f.root,jobs[0].output.path),'tampered');
  await assert.rejects(edit.collectExport(f.db,f.cfg,f.run.id,jobs[0].id,{client:c}),/成片已被修改/);
 }finally{f.close();}
});
test('manual timeline change blocks export and a corrupt native file never becomes downloadable output',async()=>{
 const f=fixture();try{
  approveForChatcut(f);const c=editingDesktopFixture(f),edit=require('../src/services/chatcutEditingService');
  const jobs=await edit.prepare(f.db,f.cfg,f.run.id,'desktop-project',{client:c});
  c.items[0].left=99;
  await assert.rejects(edit.exportJob(f.db,f.cfg,f.run.id,jobs[0].id,{client:c,exportRoot:f.root}),/时间线已修改/);assert.equal(c.exports,0);
  await assert.rejects(edit.adoptTimeline(f.db,f.cfg,f.run.id,jobs[0].id,'',{client:c}),/修改说明/);
  const adopted=await edit.adoptTimeline(f.db,f.cfg,f.run.id,jobs[0].id,'调整镜头水平位置，重新检查后采用',{client:c});
  assert.equal(adopted[0].status,'READY');assert.notEqual(adopted[0].timeline_digest,jobs[0].timeline_digest);
  assert.equal(f.db.prepare("SELECT count(*) n FROM chatcut_operations WHERE operation_key LIKE 'archive:%'").get().n,1);
  const queued=await edit.exportJob(f.db,f.cfg,f.run.id,jobs[0].id,{client:c,exportRoot:f.root});
  fs.writeFileSync(queued[0].export_path,'broken');fs.utimesSync(queued[0].export_path,new Date(0),new Date(0));
  await assert.rejects(edit.collectExport(f.db,f.cfg,f.run.id,jobs[0].id,{client:c}),/技术检查未通过/);
  assert.equal(edit.list(f.db,f.run.id)[0].output,null);
 }finally{f.close();}
});
test('opaque MG source does not block explicit file review or confer project approval; file tampering still blocks',async()=>{
 const f=fixture();try{
  approveForChatcut(f);const c=editingDesktopFixture(f),edit=require('../src/services/chatcutEditingService');
  let jobs=await edit.prepare(f.db,f.cfg,f.run.id,'desktop-project',{client:c});
  const original=c.callTool;c.callTool=async(name,args)=>{
   if(name==='execute'&&args.name==='inspect_asset'&&args.arguments.assetId==='opaque-template')return {structuredContent:{asset:{id:'opaque-template',type:'motion-graphic',html:'',properties:[]}}};
   return original(name,args);
  };
  c.items.push({id:'caption',assetId:'opaque-template',type:'motion-graphic',startFrame:0,durationFrames:30,trackId:c.tracks[0].id});
  jobs=await edit.adoptTimeline(f.db,f.cfg,f.run.id,jobs[0].id,'测试新增不可读源码字幕图层，需审核实际输出',{client:c});
  jobs=await edit.exportJob(f.db,f.cfg,f.run.id,jobs[0].id,{client:c,exportRoot:f.root});
  fs.copyFileSync(path.join(f.root,'clip0.mp4'),jobs[0].export_path);fs.utimesSync(jobs[0].export_path,new Date(0),new Date(0));
  jobs=await edit.collectExport(f.db,f.cfg,f.run.id,jobs[0].id,{client:c});
  assert.equal(jobs[0].status,'REVIEW_REQUIRED');assert.equal(jobs[0].output.layer_evidence.complete,false);
  jobs=await edit.approveExport(f.db,f.cfg,f.run.id,jobs[0].id,'隔离测试的人工文件审核记录，不证明模板源码或真实剧情通过',{client:c});
  const r=jobs[0].output.review;assert.equal(r.scope,'EXPORTED_FILE_ONLY');assert.equal(r.layer_source_evidence_complete,false);
  assert.equal(r.layer_source_gaps.length,1);assert.equal(r.project_reapproval_required_on_export,true);
  fs.appendFileSync(path.join(f.root,jobs[0].output.path),'tampered');
  await assert.rejects(edit.approveExport(f.db,f.cfg,f.run.id,jobs[0].id,'篡改后的文件不可沿用通过记录',{client:c}),/成片文件已变化/);
 }finally{f.close();}
});
test('local audio queue is idempotent, has no automatic approval, and rejects mid-review file changes',async()=>{
 const f=fixture();try{
  approveForChatcut(f);const c=editingDesktopFixture(f),edit=require('../src/services/chatcutEditingService'),audio=require('../src/services/localAudioReviewJobs');
  let jobs=await edit.prepare(f.db,f.cfg,f.run.id,'desktop-project',{client:c});
  jobs=await edit.exportJob(f.db,f.cfg,f.run.id,jobs[0].id,{client:c,exportRoot:f.root});
  fs.copyFileSync(path.join(f.root,'clip0.mp4'),jobs[0].export_path);fs.utimesSync(jobs[0].export_path,new Date(0),new Date(0));
  jobs=await edit.collectExport(f.db,f.cfg,f.run.id,jobs[0].id,{client:c});
  let resolve,calls=0;const runner=async()=>{calls++;return new Promise(r=>{resolve=r})};
  const first=audio.start(f.db,f.cfg,f.run.id,jobs[0].id,{runner});
  assert.equal(first.status,'QUEUED');assert.equal(audio.start(f.db,f.cfg,f.run.id,jobs[0].id,{runner}).id,first.id);
  for(let n=0;n<50&&!resolve;n++)await new Promise(r=>setTimeout(r,10));
  assert.equal(calls,1);assert.equal(edit.list(f.db,f.run.id)[0].audio_review.status,'RUNNING');
  fs.appendFileSync(path.join(f.root,jobs[0].output.path),'changed');
  resolve({media_sha256:jobs[0].output.sha256,segments:[{start:0,end:1,text:'测试'}]});
  for(let n=0;n<50&&edit.list(f.db,f.run.id)[0].audio_review.status==='RUNNING';n++)await new Promise(r=>setTimeout(r,10));
  assert.equal(edit.list(f.db,f.run.id)[0].audio_review.status,'STALE');assert.equal(edit.list(f.db,f.run.id)[0].status,'REVIEW_REQUIRED');
 }finally{f.close();}
});
test('local transcription failure needs explicit retry and a successful result does not approve content',async()=>{
 const f=fixture();try{
  approveForChatcut(f);const c=editingDesktopFixture(f),edit=require('../src/services/chatcutEditingService'),audio=require('../src/services/localAudioReviewJobs');
  let jobs=await edit.prepare(f.db,f.cfg,f.run.id,'desktop-project',{client:c});
  jobs=await edit.exportJob(f.db,f.cfg,f.run.id,jobs[0].id,{client:c,exportRoot:f.root});
  fs.copyFileSync(path.join(f.root,'clip0.mp4'),jobs[0].export_path);fs.utimesSync(jobs[0].export_path,new Date(0),new Date(0));
  jobs=await edit.collectExport(f.db,f.cfg,f.run.id,jobs[0].id,{client:c});let calls=0;
  const wait=async()=>{for(let n=0;n<100&&['QUEUED','RUNNING'].includes(edit.list(f.db,f.run.id)[0].audio_review?.status);n++)await new Promise(r=>setTimeout(r,10));};
  const runner=async()=>{calls++;if(calls===1)throw Error('fixture model failure');return {media_sha256:jobs[0].output.sha256,segments:[{start:0,end:1,text:'fixture'}]};};
  audio.start(f.db,f.cfg,f.run.id,jobs[0].id,{runner});await wait();
  assert.equal(audio.start(f.db,f.cfg,f.run.id,jobs[0].id,{runner}).status,'FAILED');assert.equal(calls,1);
  audio.start(f.db,f.cfg,f.run.id,jobs[0].id,{runner,retry:true});await wait();
  const done=edit.list(f.db,f.run.id)[0];assert.equal(done.audio_review.status,'DONE');assert.equal(calls,2);assert.equal(done.status,'REVIEW_REQUIRED');assert.equal(done.output.content_status,'REQUIRES_REVIEW');
  assert.equal(done.audio_review.result.alignment_gaps.length,1);
 }finally{f.close();}
});

test('fractional audio duration never extends the item past the source',async()=>{
 const f=fixture();try{
  await inspect.command(getFfmpegPath(),['-v','error','-f','lavfi','-i','sine=frequency=440:duration=3.165','-ar','22050','-c:a','pcm_s16le',path.join(f.root,'fractional.wav')]);
  const frames=await require('../src/services/chatcutEditingService').audioFrames(f.cfg,{local_path:'fractional.wav'},30);
  assert.equal(frames,94);assert.ok(frames/30<=3.165);assert.ok(3.165-frames/30<1/30);
 }finally{f.close();}
});
test('read-only timeline validation failure remains safely retryable without duplicate imports',async()=>{
 const f=fixture();try{
  approveForChatcut(f);const c=editingDesktopFixture(f),edit=require('../src/services/chatcutEditingService');
  const original=c.callTool;let fail=true;
  c.callTool=async(name,args)=>{if(fail&&name==='execute'&&args.name==='edit_item'&&args.arguments.validateOnly)throw Error('source range exceeds asset');return original(name,args);};
  await assert.rejects(edit.prepare(f.db,f.cfg,f.run.id,'desktop-project',{client:c}),/source range/);
  assert.equal(c.items.length,0);assert.equal(f.db.prepare("SELECT count(*) n FROM chatcut_operations WHERE operation_key='items'").get().n,0);
  fail=false;const jobs=await edit.prepare(f.db,f.cfg,f.run.id,'desktop-project',{client:c});
  assert.equal(jobs[0].status,'READY');assert.equal(c.created,1);assert.equal(c.pushes,1);
 }finally{f.close();}
});


test('old action-only PASS cannot omit prop state review; uncertain outcome never passes',()=>{
 const old=verdict('PASS');old.checks=old.checks.filter(x=>x.criterion!=='道具交互前后状态');
 assert.throws(()=>review.validate(old),/缺少逐项/);
 const r=verdict('UNCERTAIN');r.findings=[];r.checks=r.checks.map(x=>({...x,status:x.criterion==='道具交互前后状态'?'UNCERTAIN':'PASS',evidence:x.criterion==='道具交互前后状态'?'0秒竖直；2秒手遮挡；4秒仍竖直，无法确认锁定':'已检查'}));
 assert.equal(review.validate(r).decision,'UNCERTAIN');
 r.decision='PASS';assert.throws(()=>review.validate(r),/结论与证据矛盾/);
});

test('incomplete shot blocks video submission before provider request',async()=>{
 const f=fixture(),video=require('../src/services/videoService'),original=video.processVideoGeneration;
 try {let calls=0;video.processVideoGeneration=async()=>{calls++;};
 f.db.prepare("UPDATE storyboards SET lighting_style=NULL WHERE id=?").run(f.shot.id);
 f.db.prepare("UPDATE agent_runs SET dry_run=0,status='MEDIA_GENERATING' WHERE id=?").run(f.run.id);
 require('../src/services/agentProductionService').runAction(f.db,f.cfg,log,f.run.id,'media');
 let r;for(let i=0;i<100;i++){await new Promise(resolve=>setTimeout(resolve,20));r=wb.getRun(f.db,f.run.id);if(r.status==='FAILED')break;}
 assert.equal(r.status,'FAILED');assert.equal(calls,0);assert.ok(r.steps.some(s=>/光影/.test(s.error_message||'')));
 }finally{video.processVideoGeneration=original;f.close();}
});
