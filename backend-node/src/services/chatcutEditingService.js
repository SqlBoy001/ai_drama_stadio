const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const evidence = require('./agentMediaEvidence');
const handoffs = require('./editingHandoffService');
const { importAssets } = require('./chatcutAssetImporter');
const { createClient } = require('./chatcutMcpClient');
const inspection = require('./agentVideoInspection');
const { getFfprobePath } = require('../utils/ffmpegPath');
const locks = new Set();
const describedClients = new WeakSet();
function structured(r) {
  if (!r?.structuredContent || r.isError) throw new Error('ChatCut没有返回可核验数据');
  return r.structuredContent;
}
function update(db, id, fields) {
  fields.updated_at = new Date().toISOString();
  db.prepare(`UPDATE chatcut_editing_jobs SET ${Object.keys(fields).map(k=>`${k}=?`).join(',')} WHERE id=?`)
    .run(...Object.values(fields), id);
}
function list(db, runId) {
  return db.prepare('SELECT * FROM chatcut_editing_jobs WHERE run_id=? ORDER BY created_at DESC').all(runId)
    .map(({timeline_snapshot_json,...r})=>({...r,audio_review:require('./localAudioReviewJobs').read(db,r),output:r.output_json?JSON.parse(r.output_json):null,output_json:undefined}));
}
function fresh(db,cfg,runId,digest) {
  const h=handoffs.build(db,cfg,runId);
  if(h.handoff_digest!==digest)throw new Error('批准素材或文本已变化，必须重新审核并交接');
  return h;
}
async function context(client,projectId) {
  const a=structured(await client.callTool('get_active_project'));
  if(a.projectId!==projectId)throw new Error('ChatCut目标工程不一致');
}
async function execute(client,projectId,name,args) {
  await context(client,projectId);
  if (!describedClients.has(client)) {
    const guide = structured(await client.callTool('get_guidelines'));
    if (!guide.operations?.some(o => o.name === name)) throw new Error('当前ChatCut不支持所需剪辑操作');
    describedClients.add(client);
  }
  return structured(await client.callTool('execute',{name,arguments:args}));
}
async function editTimeline(client,projectId,timelineId,name,args) {
  const project=await execute(client,projectId,'read_project',{});
  if(project.activeTimeline?.id!==timelineId)throw new Error('活动时间线已切换，停止修改以保护其他工程内容');
  return execute(client,projectId,name,args);
}
async function journal(db,job,key,action) {
  const row=db.prepare('SELECT * FROM chatcut_operations WHERE job_id=? AND operation_key=?').get(job.id,key);
  if(row){if(row.status==='DONE')return JSON.parse(row.response_json);throw new Error('上次剪辑操作结果待核对，禁止自动重复提交');}
  db.prepare("INSERT INTO chatcut_operations(job_id,operation_key,status) VALUES(?,?,'PENDING')").run(job.id,key);
  try{const result=await action();db.prepare("UPDATE chatcut_operations SET status='DONE',response_json=? WHERE job_id=? AND operation_key=?").run(JSON.stringify(result),job.id,key);return result;}
  catch(e){db.prepare("UPDATE chatcut_operations SET status='UNKNOWN' WHERE job_id=? AND operation_key=?").run(job.id,key);throw e;}
}
async function snapshot(client, projectId, timelineId) {
  await execute(client,projectId,'manage_timelines',{action:'switch',timelineId});
  const project=await execute(client,projectId,'read_project',{});
  if(project.activeTimeline?.id!==timelineId)throw new Error('时间线在核对期间被切换');

  let offset=0, all=[], first;
  do {
    const r=await execute(client,projectId,'preview_timeline',{timelineId,views:['timeline'],limit:100,offset});
    first ||= r;
    if(r.state.id!==first.state.id || r.state.fps!==first.state.fps)throw new Error('时间线在回读期间变化');
    all.push(...r.timeline.entries);offset+=r.timeline.entries.length;
    if(!r.timeline.entries.length && offset<r.timeline.totalEntries)throw new Error('时间线回读不完整');
    if(offset>=r.timeline.totalEntries)break;
    if(offset>10000)throw new Error('时间线超出验收范围');
  }while(true);
  const items=[];
  for(const e of all.filter(e=>e.kind==='item')) {
    const r=await execute(client,projectId,'inspect_item',{itemId:e.id,timelineId:first.state.id});

    items.push(r.item);
  }
  const layers=await require('./chatcutLayerEvidence').capture(items,(name,args)=>execute(client,projectId,name,args),project.activeTimeline.captionsPresent);
  const end=await execute(client,projectId,'read_project',{});
  if(end.activeTimeline?.id!==timelineId)throw new Error('时间线在核对期间被切换');
  const stable={timeline_id:first.state.id,fps:first.state.fps,canvas:first.state.canvas,
    durationFrames:first.state.durationFrames,tracks:first.timeline.tracks,items,
    ...(layers.assets.length||layers.captions||layers.gaps.length?{layers}:{})};
  return { ...stable,digest:evidence.digest(stable),entries:all };
}
async function audioFrames(cfg,asset,fps) {
  const file=evidence.localFile(evidence.storageRoot(cfg),asset.local_path);
  const p=JSON.parse(await inspection.command(getFfprobePath(),['-v','error','-protocol_whitelist','file,pipe','-show_format','-of','json',file]));
  // A timeline item cannot include a partial source frame. Ceil exceeds the
  // source duration and Desktop rejects otherwise valid voice recordings.
  const n=Math.floor(Number(p.format?.duration)*fps + 1e-7);
  if(!Number.isFinite(n)||n<=0)throw new Error('旁白文件时长无效');return n;
}
async function prepare(db,cfg,runId,projectId,{client=createClient()}={}) {
  if(locks.has(projectId)){client.close?.();throw new Error('当前ChatCut工程正在处理，请稍后刷新');}
  locks.add(projectId);const touched=[];
  try {
    const h=handoffs.build(db,cfg,runId);
    const binding=await importAssets(db,cfg,runId,projectId,client);
    for(const episode of h.timelines) {
      let job=db.prepare('SELECT * FROM chatcut_editing_jobs WHERE run_id=? AND handoff_digest=? AND project_id=? AND episode_id=?').get(runId,h.handoff_digest,projectId,episode.episode_id);
      if(!job){const now=new Date().toISOString();const id=randomUUID();db.prepare(`INSERT INTO chatcut_editing_jobs(id,run_id,handoff_digest,project_id,episode_id,status,created_at,updated_at) VALUES(?,?,?,?,?,'BUILDING',?,?)`).run(id,runId,h.handoff_digest,projectId,episode.episode_id,now,now);job=db.prepare('SELECT * FROM chatcut_editing_jobs WHERE id=?').get(id);}
      touched.push(job.id);fresh(db,cfg,runId,h.handoff_digest);
      if(job.timeline_digest) {
        const current=await snapshot(client,projectId,job.timeline_id);
        if(current.digest!==job.timeline_digest)throw new Error('剪辑工程已发生人工修改，请先重新核对');
        continue;
      }
      const ratio=h.canvas.aspect_ratio;const size=ratio==='16:9'?[1280,720]:ratio==='1:1'?[720,720]:[720,1280];
      await journal(db,job,'create',()=>execute(client,projectId,'manage_timelines',{action:'create',name:`AI_Drama ${runId.slice(0,8)} EP${episode.episode_id} ${job.id.slice(0,8)}`,compositionWidth:size[0],compositionHeight:size[1],activate:true}));
      // Locate this unique job name through the actual project directory, not response-shape guesses.
      const project=await execute(client,projectId,'read_project',{});
      const found=project.timelines.filter(t=>t.name.endsWith(job.id.slice(0,8)));
      if(found.length!==1)throw new Error('无法唯一核对新建时间线');
      const timelineId=found[0].id;update(db,job.id,{timeline_id:timelineId});
      await execute(client,projectId,'manage_timelines',{action:'switch',timelineId});
      for(const [name,type] of [['原始画面','video'],['独立对白','audio'],['独立旁白','audio']]) {
        await journal(db,job,`track:${name}`,()=>editTimeline(client,projectId,timelineId,'edit_track',{action:'create',json:JSON.stringify({trackType:type,name})}));
      }
      const initial=await snapshot(client,projectId,timelineId);const fps=initial.fps;
      const track=name=>{const t=initial.tracks.filter(t=>t.name===name);if(t.length!==1)throw new Error('轨道无法唯一匹配');return t[0].id;};
      const asset=id=>{const a=binding.assets.find(a=>a.source_id===id);if(!a)throw new Error('素材映射缺失');return a.asset_id;};
      const adds=[];
      for(const clip of episode.clips) {
        const start=Math.round(clip.timeline_start*fps),end=Math.round((clip.timeline_start+clip.source_out-clip.source_in)*fps);
        const hasVoice=episode.audio.some(a=>a.timeline_start===clip.timeline_start);
        adds.push({type:'video',assetId:asset(clip.asset_id),trackId:track('原始画面'),startFrame:start,durationFrames:end-start,
          sourceIn:Math.round(clip.source_in*1e6),left:0,top:0,width:size[0],height:size[1],decibelAdjustment:hasVoice?-60:0});
      }
      for(const voice of episode.audio) {
        const src=h.assets.find(a=>a.id===voice.asset_id);const duration=await audioFrames(cfg,src,fps);
        const clip=episode.clips.find(c=>c.timeline_start===voice.timeline_start);const available=Math.round((clip.source_out-clip.source_in)*fps);
        if(duration>available)throw new Error('配音超过镜头长度，需调整剪辑，不能静默截断');
        adds.push({type:'audio',assetId:asset(voice.asset_id),trackId:track(voice.track==='A_DIALOGUE'?'独立对白':'独立旁白'),
          startFrame:Math.round(voice.timeline_start*fps),durationFrames:duration,sourceIn:0});
      }
      fresh(db,cfg,runId,h.handoff_digest);
      // Never touch the user's currently-selected different timeline.
      await execute(client,projectId,'manage_timelines',{action:'switch',timelineId});
      const priorItems = db.prepare('SELECT status FROM chatcut_operations WHERE job_id=? AND operation_key=?').get(job.id,'items');
      if (!priorItems) {
        const empty=await snapshot(client,projectId,timelineId);if(empty.items.length)throw new Error('新时间线已有内容，拒绝覆盖');
        // Validation is read-only: rejection must not be journaled as an uncertain mutation.
        await editTimeline(client,projectId,timelineId,'edit_item',{adds,validateOnly:true});
      }
      await journal(db,job,'items',()=>editTimeline(client,projectId,timelineId,'edit_item',{adds}));
      const complete=await snapshot(client,projectId,timelineId);
      if(complete.items.length!==adds.length || complete.durationFrames!==Math.round(episode.duration*fps))throw new Error('时间线片段数量或时长不符');
      for(const expected of adds) {
        if(!complete.entries.some(e=>e.kind==='item'&&e.asset.id===expected.assetId&&e.trackId===expected.trackId&&e.startFrame===expected.startFrame&&e.timelineRange.toFrame-e.startFrame===expected.durationFrames))throw new Error('剪辑时间线回读与计划不一致');
      }
      fresh(db,cfg,runId,h.handoff_digest);
      update(db,job.id,{status:'READY',timeline_id:timelineId,timeline_digest:complete.digest,timeline_snapshot_json:JSON.stringify(complete),error:null});
    }
    return list(db,runId).filter(job=>job.handoff_digest===h.handoff_digest && job.project_id===projectId);
  }catch(e){for(const id of touched)update(db,id,{status:'BLOCKED',error:e.message});throw e;}
  finally{locks.delete(projectId);client.close?.();}
}
module.exports={prepare,list,snapshot,execute,structured,fresh,update,journal,audioFrames};

async function exportJob(db,cfg,runId,jobId,{client=createClient(),exportRoot=path.join(os.homedir(),'Movies','ChatCut')}={}) {
  const job=db.prepare('SELECT * FROM chatcut_editing_jobs WHERE id=? AND run_id=?').get(jobId,runId);
  if(!job){client.close?.();throw new Error('剪辑任务不存在');}
  if(locks.has(job.project_id)){client.close?.();throw new Error('当前ChatCut工程正在处理');}
  locks.add(job.project_id);
  try {
    fresh(db,cfg,runId,job.handoff_digest);
    if(!job.timeline_digest || !['READY','EXPORT_QUEUED','REVIEW_REQUIRED','APPROVED'].includes(job.status))throw new Error('时间线尚未就绪或需要核对');
    const current=await snapshot(client,job.project_id,job.timeline_id);
    if(current.digest!==job.timeline_digest)throw new Error('时间线已修改，必须重新核对后导出');
    if(['REVIEW_REQUIRED','APPROVED'].includes(job.status))return list(db,runId);
    const filename=`ai-drama-${job.id}-${job.timeline_digest.slice(0,12)}.mp4`,expected=path.join(exportRoot,filename);
    const queued=await journal(db,job,`export:${job.timeline_digest}`,async()=>{
      if(fs.existsSync(expected))throw new Error('导出目标已存在，拒绝覆盖');
      fresh(db,cfg,runId,job.handoff_digest);
      return execute(client,job.project_id,'local_export',{format:'video',resolution:'720p',fps:current.fps,timelineId:job.timeline_id,outputPath:filename});
    });
    if(typeof queued.taskId!=='string'||path.resolve(queued.outputPath||'')!==path.resolve(expected))throw new Error('导出回执路径不匹配');
    update(db,job.id,{status:'EXPORT_QUEUED',export_path:expected,error:null});
    return list(db,runId);
  }catch(e){update(db,job.id,{status:'BLOCKED',error:e.message});throw e;}
  finally{locks.delete(job.project_id);client.close?.();}
}
async function collectExport(db,cfg,runId,jobId,{client=createClient()}={}) {
  const job=db.prepare('SELECT * FROM chatcut_editing_jobs WHERE id=? AND run_id=?').get(jobId,runId);
  if(!job){client.close?.();throw new Error('剪辑任务不存在');}
  if(locks.has(job.project_id)){client.close?.();throw new Error('当前ChatCut工程正在处理');}
  locks.add(job.project_id);
  try {
    const h=fresh(db,cfg,runId,job.handoff_digest);
    if(['REVIEW_REQUIRED','APPROVED'].includes(job.status)) {
      const timeline=await snapshot(client,job.project_id,job.timeline_id);
      if(timeline.digest!==job.timeline_digest)throw new Error('回传后时间线已修改，旧成片仅代表旧版本');
      const output=JSON.parse(job.output_json);const now=evidence.fingerprint(evidence.storageRoot(cfg),output.path);
      if(now.sha256!==output.sha256)throw new Error('回传成片已被修改');
      return list(db,runId);
    }
    if(job.status!=='EXPORT_QUEUED'||!job.export_path)throw new Error('尚未提交导出任务');
    if(!fs.existsSync(job.export_path))return list(db,runId);
    const before=fs.statSync(job.export_path);
    // Recent writes mean the native renderer is still working. Polling this endpoint does not resubmit exports.
    if(Date.now()-before.mtimeMs<2000||!before.size)return list(db,runId);
    const current=await snapshot(client,job.project_id,job.timeline_id);
    if(current.digest!==job.timeline_digest)throw new Error('导出期间时间线变化，请重新核对');
    const root=evidence.storageRoot(cfg);const dir=path.join(root,'chatcut-exports');fs.mkdirSync(dir,{recursive:true});
    const destination=path.join(dir,`${job.id}-${randomUUID()}.mp4`);
    fs.copyFileSync(job.export_path,destination,fs.constants.COPYFILE_EXCL);
    const after=fs.statSync(job.export_path);
    if(before.size!==after.size||before.mtimeMs!==after.mtimeMs){fs.unlinkSync(destination);return list(db,runId);}
    const relative=path.relative(root,destination),timeline=JSON.parse(job.timeline_snapshot_json);
    const report=await inspection.inspect(cfg,{local_path:relative},{duration:timeline.durationFrames/timeline.fps,aspect_ratio:h.canvas.aspect_ratio},{extractFrames:false});
    if(report.status!=='TECHNICAL_PASS'){fs.unlinkSync(destination);throw new Error('实际导出文件技术检查未通过，不能回传为完成');}
    fresh(db,cfg,runId,job.handoff_digest);
    const signalReview=await require('./finalCutInspection').inspect(cfg,relative);
    const final=await snapshot(client,job.project_id,job.timeline_id);
    if(final.digest!==job.timeline_digest)throw new Error('回传期间时间线变化');
    const fingerprint=evidence.fingerprint(root,relative);
    const output={layer_evidence:final.layers || null,signal_review:signalReview,path:relative,url:`/static/${relative.split(path.sep).join('/')}`,sha256:fingerprint.sha256,
      bytes:fingerprint.bytes,inspection:report,content_status:'REQUIRES_REVIEW',timeline_id:job.timeline_id,timeline_digest:job.timeline_digest};
    update(db,job.id,{status:'REVIEW_REQUIRED',output_json:JSON.stringify(output),error:null});
    return list(db,runId);
  }catch(e){update(db,job.id,{status:'BLOCKED',error:e.message});throw e;}
  finally{locks.delete(job.project_id);client.close?.();}
}
module.exports.exportJob=exportJob;
module.exports.collectExport=collectExport;

async function approveExport(db,cfg,runId,jobId,comment,{client=createClient()}={}) {
  const reason=typeof comment==='string'?comment.trim():'';
  if(reason.length<5||reason.length>2000){client.close?.();throw new Error('请填写5至2000字的完整动作、声音和剧情审核依据');}
  const job=db.prepare('SELECT * FROM chatcut_editing_jobs WHERE id=? AND run_id=?').get(jobId,runId);
  if(!job){client.close?.();throw new Error('剪辑任务不存在');}
  if(locks.has(job.project_id)){client.close?.();throw new Error('当前ChatCut工程正在处理');}
  locks.add(job.project_id);
  try {
    fresh(db,cfg,runId,job.handoff_digest);
    if(!['REVIEW_REQUIRED','APPROVED'].includes(job.status))throw new Error('成片尚未完成技术检查');
    const output=JSON.parse(job.output_json);
    const file=evidence.fingerprint(evidence.storageRoot(cfg),output.path);
    if(file.sha256!==output.sha256||file.bytes!==output.bytes)throw new Error('成片文件已变化，不能沿用旧审核');
    const current=await snapshot(client,job.project_id,job.timeline_id);
    if(current.digest!==job.timeline_digest)throw new Error('时间线已变化，不能沿用旧审核');
    if(job.status==='APPROVED')return list(db,runId);
    fresh(db,cfg,runId,job.handoff_digest);
    if(evidence.fingerprint(evidence.storageRoot(cfg),output.path).sha256!==output.sha256)throw new Error('审核期间成片变化');
    output.content_status='HUMAN_ACCEPTED';
    output.review={comment:reason,reviewed_at:new Date().toISOString(),sha256:output.sha256,timeline_digest:job.timeline_digest,
      scope:'EXPORTED_FILE_ONLY',project_reapproval_required_on_export:true,
      layer_source_evidence_complete:current.layers?.complete ?? true,
      layer_source_gaps:current.layers?.gaps || []};
    update(db,job.id,{status:'APPROVED',output_json:JSON.stringify(output),error:null});
    return list(db,runId);
  }catch(e){update(db,job.id,{status:'BLOCKED',error:e.message});throw e;}
  finally{locks.delete(job.project_id);client.close?.();}
}
module.exports.approveExport=approveExport;

async function adoptTimeline(db,cfg,runId,jobId,comment,{client=createClient()}={}) {
  const reason=typeof comment==='string'?comment.trim():'';
  if(reason.length<5||reason.length>2000){client.close?.();throw new Error('请填写5至2000字的剪辑修改说明');}
  const job=db.prepare('SELECT * FROM chatcut_editing_jobs WHERE id=? AND run_id=?').get(jobId,runId);
  if(!job){client.close?.();throw new Error('剪辑任务不存在');}
  if(locks.has(job.project_id)){client.close?.();throw new Error('当前ChatCut工程正在处理');}
  locks.add(job.project_id);
  try {
    fresh(db,cfg,runId,job.handoff_digest);
    if(job.status==='EXPORT_QUEUED')throw new Error('请等待当前导出回传后再采用新版本');
    if(!job.timeline_digest)throw new Error('时间线未完成建立，须先核对不确定操作');
    const pending=db.prepare("SELECT count(*) n FROM chatcut_operations WHERE job_id=? AND status<>'DONE'").get(job.id).n;
    if(pending)throw new Error('存在结果不明的剪辑操作，必须先对账');
    const current=await snapshot(client,job.project_id,job.timeline_id);
    if(current.digest===job.timeline_digest)return list(db,runId);
    if(current.durationFrames<=0||current.durationFrames/current.fps>600||!current.items.length)throw new Error('当前剪辑时长无效');
    const allowed=db.prepare("SELECT asset_id FROM chatcut_asset_imports WHERE run_id=? AND handoff_digest=? AND project_id=? AND status='IMPORTED'").all(runId,job.handoff_digest,job.project_id);
    for(const entry of current.items) {
      const item=entry.item;
      if(item.type==='motion-graphic')continue;
      if(!['video','audio'].includes(item.type))throw new Error('当前包含尚未支持的图层类型');
      const id=String(item.assetId||'').replaceAll('-','');
      if(id.length<10||!allowed.some(a=>a.asset_id.replaceAll('-','').startsWith(id)))throw new Error('时间线含未批准素材，不能沿用原素材审核');
    }
    fresh(db,cfg,runId,job.handoff_digest);
    db.transaction(()=>{
      db.prepare("INSERT OR IGNORE INTO chatcut_operations(job_id,operation_key,status,response_json) VALUES(?,?,'DONE',?)")
        .run(job.id,`archive:${job.timeline_digest}`,JSON.stringify({timeline_digest:job.timeline_digest,output:job.output_json?JSON.parse(job.output_json):null,status:job.status,comment:reason,archived_at:new Date().toISOString()}));
      update(db,job.id,{status:'READY',timeline_digest:current.digest,timeline_snapshot_json:JSON.stringify(current),export_path:null,output_json:null,error:null});
    })();
    return list(db,runId);
  }finally{locks.delete(job.project_id);client.close?.();}
}
module.exports.adoptTimeline=adoptTimeline;
