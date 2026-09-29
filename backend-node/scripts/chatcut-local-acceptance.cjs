// Explicit opt-in real Desktop test. Only local FFmpeg fixtures, isolated SQLite,
// and a new labelled timeline; no paid generation or historical approval rewriting.
const fs=require('node:fs'),path=require('node:path');
const Database=require('better-sqlite3');
const {runMigrationsAndEnsure}=require('../src/db/migrate');
const wb=require('../src/services/agentWorkbenchService'),inspection=require('../src/services/agentVideoInspection');
const gate=require('../src/services/agentImageGate'),editing=require('../src/services/chatcutEditingService');
const {getFfmpegPath}=require('../src/utils/ffmpegPath');
const project=process.argv[2];if(!project)throw new Error('Explicit Desktop project ID required');
const dir=path.resolve(__dirname,'../data/acceptance',`chatcut-pipeline-${Date.now()}`);fs.mkdirSync(dir,{recursive:true});
const cfg={storage:{local_path:dir}};require('../src/config').loadConfig=()=>cfg;
const db=new Database(path.join(dir,'isolated.db'));runMigrationsAndEnsure(db);
(async()=>{try{
 await inspection.command(getFfmpegPath(),['-v','error','-f','lavfi','-i','color=c=blue:s=720x1280:r=30:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',path.join(dir,'fixture.mp4')]);
 await require('sharp')({create:{width:32,height:32,channels:3,background:'blue'}}).png().toFile(path.join(dir,'ref.png'));
 let run=wb.createRun(db,{info(){},warn(){},error(){}},{instruction:'内部自动剪辑接口测试：蓝色色块与提示音，非作品',dry_run:true,episode_count:1,episode_duration_seconds:30,budget_limit:100});
 for(let i=0;i<2;i++)run=wb.approve(db,run.approvals.find(a=>a.status==='PENDING').id,'approve');
 const shot=db.prepare('SELECT id FROM storyboards LIMIT 1').get().id;db.prepare('DELETE FROM storyboards WHERE id<>?').run(shot);
 db.prepare("UPDATE storyboards SET title='内部色块测试',video_url='fixture.mp4',local_path='ref.png',duration=2,dialogue='',narration='',characters='[]',scene_id=NULL WHERE id=?").run(shot);
 if(process.argv.includes('--voice')) {
  await inspection.command(getFfmpegPath(),['-v','error','-f','lavfi','-i','sine=frequency=880:duration=1.2','-c:a','pcm_s16le','-y',path.join(dir,'voice.wav')]);
  db.prepare("UPDATE storyboards SET narration_audio_local_path='voice.wav',narration='内部测试提示音' WHERE id=?").run(shot);
 }
 const a=run.approvals.find(a=>a.status==='PENDING');db.prepare("UPDATE approval_requests SET status='APPROVED',snapshot_json=?,resolved_at='now' WHERE id=?").run(JSON.stringify(gate.snapshot(db,run.project_id,cfg)),a.id);
 db.prepare("UPDATE agent_runs SET dry_run=0,status='FINAL_REVIEW' WHERE id=?").run(run.id);run=wb.getRun(db,run.id);
 const source=inspection.snapshot(db,run,cfg);const report=await inspection.inspect(cfg,{local_path:'fixture.mp4'},{duration:2,aspect_ratio:'9:16'},{extractFrames:false});
 db.prepare("INSERT INTO approval_requests(id,run_id,target_type,approval_stage,status,snapshot_json,resolved_at,created_at) VALUES('fixture-final',?,'episode','final_video','APPROVED',?,'now','now')").run(run.id,JSON.stringify({media_digest:source.digest,inspections:[{shot_id:shot,report}]}));
 fs.writeFileSync(path.join(dir,'context.json'),JSON.stringify({run_id:run.id,project_id:project,root:dir}));
 const jobs=await editing.prepare(db,cfg,run.id,project);console.log('PREPARED',JSON.stringify(jobs));
 await editing.exportJob(db,cfg,run.id,jobs[0].id);console.log('QUEUED',dir);
}catch(e){console.error(e.stack);console.error('EVIDENCE_DIR',dir);process.exitCode=1;}finally{db.close();}})();
