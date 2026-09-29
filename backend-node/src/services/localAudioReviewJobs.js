const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const evidence=require('./agentMediaEvidence');
const {compare}=require('./audioTranscriptReview');
const {command}=require('./agentVideoInspection');
const queue=[];let working=false;
const initialized=new WeakSet();
function recover(db) {
 if(initialized.has(db))return;initialized.add(db);
 db.prepare("UPDATE local_audio_reviews SET status='INTERRUPTED',error='服务重启中断，请手动重试本地转写',updated_at=? WHERE status IN ('QUEUED','RUNNING')").run(new Date().toISOString());
}
function runtime(cfg) {
 const base=path.resolve(__dirname,'../../data/local-asr');
 const python=cfg.local_asr?.python || path.join(base,'venv/bin/python');
 const model=cfg.local_asr?.model || path.join(base,'model');
 return {python,model,available:fs.existsSync(python)&&fs.existsSync(path.join(model,'model.bin'))};
}
function read(db,job,cfg) {
 recover(db);
 const output=job.output_json?JSON.parse(job.output_json):job.output;
 if(!output)return null;
 const row=db.prepare('SELECT * FROM local_audio_reviews WHERE job_id=? AND media_sha256=? AND timeline_digest=?').get(job.id,output.sha256,job.timeline_digest);
 if(!row)return null;
 if(row.status==='DONE') {
  try { current(db,cfg,job.id,row.media_sha256,row.timeline_digest); }
  catch(e) {row.status='STALE';row.error=String(e.message);row.result_json=null;db.prepare('UPDATE local_audio_reviews SET status=?,error=? WHERE id=?').run(row.status,row.error,row.id);}
 }
 return {id:row.id,status:row.status,error:row.error,result:row.result_json?JSON.parse(row.result_json):null,updated_at:row.updated_at};
}
function contract(h,timeline,mappings) {
 const expected=[],gaps=[];
 for(const entry of timeline.items) {
  const item=entry.item;
  if(!['video','audio'].includes(item.type))continue;
  const id=String(item.assetId||'').replaceAll('-','');
  const matches=mappings.filter(m=>id.length>=10&&m.asset_id.replaceAll('-','').startsWith(id));
  if(matches.length!==1){gaps.push('音视频资产映射不唯一');continue;}
  const source=matches[0].source_id;
  const track=timeline.tracks.find(t=>String(t.id).replaceAll('-','').startsWith(String(entry.track?.id||item.trackId||'').replaceAll('-','')));
  if(!track){gaps.push('无法核验音轨的静音状态');continue;}
  if(track.muted || item.muted || item.decibelAdjustment<=-60)continue;
  const [kind,shotId]=source.split(':');
  const cue=h.dialogue_cues.find(c=>String(c.shot_id)===shotId);
  const text=kind==='narration_audio_local_path'?cue?.narration:kind==='audio_local_path'?cue?.dialogue:[cue?.dialogue,cue?.narration].filter(Boolean).join(' ');
  if(!text)continue;
  if(Number(item.sourceIn||0)!==0 || Number(item.playbackRate||1)!==1){gaps.push(`镜头${shotId}含源裁切或变速，不能直接沿用完整台词`);continue;}
  expected.push({source_id:source,item_id:item.id,start:item.startFrame/timeline.fps,end:(item.startFrame+item.durationFrames)/timeline.fps,text});
 }
 expected.sort((a,b)=>a.start-b.start);
 if(!expected.length)gaps.push('没有可按当前剪辑对齐的台词合同，仅提供整轨转写');
 return {expected,gaps};
}
function current(db,cfg,jobId,sha,timelineDigest) {
 const job=db.prepare('SELECT * FROM chatcut_editing_jobs WHERE id=?').get(jobId);
 if(!job?.output_json||job.timeline_digest!==timelineDigest)throw Error('STALE:剪辑或输出版本已变化');
 const out=JSON.parse(job.output_json);
 if(out.sha256!==sha)throw Error('STALE:导出文件已换版');
 const file=evidence.fingerprint(evidence.storageRoot(cfg),out.path);
 if(file.sha256!==sha)throw Error('STALE:成片文件已被修改');
 return {job,out,file};
}
async function transcribe(cfg,stored) {
 const r=runtime(cfg);if(!r.available)throw Error('未安装本地语音模型');
 const root=evidence.storageRoot(cfg),file=evidence.localFile(root,stored),dir=path.join(root,'audio-reviews');fs.mkdirSync(dir,{recursive:true});
 const out=path.join(dir,`${randomUUID()}.json`);
 await command(r.python,[path.resolve(__dirname,'../../scripts/transcribe-local.py'),file,'--model',r.model,'--output',out],600000);
 if(fs.statSync(out).size>2*1024*1024)throw Error('转写结果超过2MB范围');
 return JSON.parse(fs.readFileSync(out,'utf8'));
}
async function drain() {
 if(working)return;working=true;
 try {while(queue.length)await queue.shift()();}finally{working=false;}
}
function start(db,cfg,runId,jobId,{retry=false,runner=transcribe}={}) {
 recover(db);
 const job=db.prepare('SELECT * FROM chatcut_editing_jobs WHERE id=? AND run_id=?').get(jobId,runId);
 if(!job || !['REVIEW_REQUIRED','APPROVED'].includes(job.status) || !job.output_json)throw Error('需要已回传且技术检查通过的成片');
 const out=JSON.parse(job.output_json);current(db,cfg,jobId,out.sha256,job.timeline_digest);
 const h=require('./editingHandoffService').build(db,cfg,runId);
 if(h.handoff_digest!==job.handoff_digest)throw Error('批准内容已变化，不能对照旧台词');
 if(runner===transcribe&&!runtime(cfg).available)throw Error('本地转写未安装；运行安装脚本后重试，不会回退到付费API');
 const old=read(db,job,cfg);
 if(old && (!retry || !['FAILED','INTERRUPTED'].includes(old.status)))return old;
 if(queue.length>=5)throw Error('本地转写排队已满，请稍后提交');
 const episode=h.timelines.find(e=>e.episode_id===job.episode_id);
 const mappings=db.prepare("SELECT source_id,asset_id FROM chatcut_asset_imports WHERE run_id=? AND handoff_digest=? AND project_id=? AND status='IMPORTED'").all(runId,job.handoff_digest,job.project_id);
 const c=contract(episode,JSON.parse(job.timeline_snapshot_json),mappings),id=old?.id||randomUUID(),now=new Date().toISOString();
 const save=(status,result,error)=>db.prepare('UPDATE local_audio_reviews SET status=?,result_json=?,error=?,updated_at=? WHERE id=?').run(status,result?JSON.stringify(result):null,error||null,new Date().toISOString(),id);
 if(old)save('QUEUED',null,null);
 else db.prepare("INSERT INTO local_audio_reviews(id,job_id,media_sha256,timeline_digest,status,contract_json,created_at,updated_at) VALUES(?,?,?,?,'QUEUED',?,?,?)").run(id,jobId,out.sha256,job.timeline_digest,JSON.stringify(c),now,now);
 queue.push(async()=>{
  try {
   const initial=current(db,cfg,jobId,out.sha256,job.timeline_digest);save('RUNNING');
   const t=await runner(cfg,initial.out.path);
   const final=current(db,cfg,jobId,out.sha256,job.timeline_digest);
   const fresh=require('./editingHandoffService').build(db,cfg,runId);
   if(fresh.handoff_digest!==h.handoff_digest)throw Error('STALE:审核期间批准台词发生变化');
   if(t.media_sha256!==out.sha256 || !Array.isArray(t.segments))throw Error('转写缺少正确文件指纹或分段');
   const result=c.expected.length?compare(final.file,t,c.expected):{rows:[],status:'REQUIRES_CONTENT_REVIEW'};
   result.transcript=t;result.alignment_gaps=c.gaps;
   if(!t.segments.length)result.alignment_gaps.push('没有识别到语音；不可据此证明预期台词存在');
   save('DONE',result);
  }catch(e){save(String(e.message).startsWith('STALE:')?'STALE':'FAILED',null,String(e.message).slice(0,2000));}
 });
 setImmediate(()=>drain().catch(()=>{}));
 return read(db,job,cfg);
}
module.exports={start,read,recover,runtime,contract};
