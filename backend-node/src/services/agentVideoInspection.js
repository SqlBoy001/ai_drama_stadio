const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { getFfmpegPath, getFfprobePath } = require('../utils/ffmpegPath');
const evidence = require('./agentMediaEvidence');
function command(binary, args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary,args,{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',oversized=false;
    const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);
    const collect=(kind,chunk)=>{
      if(kind==='out') stdout+=chunk.toString();else stderr+=chunk.toString();
      if(stdout.length+stderr.length>2*1024*1024){oversized=true;child.kill('SIGKILL');}
    };
    child.stdout.on('data',c=>collect('out',c));child.stderr.on('data',c=>collect('err',c));
    child.on('error',err=>{clearTimeout(timer);reject(err);});
    child.on('close',(code,signal)=>{clearTimeout(timer);if(code!==0)reject(new Error(`本地媒体检查失败${signal?'（超时或超限）':''}: ${oversized?'日志超限':stderr || code}`));else resolve(stdout);});
  });
}
async function inspect(cfg, video, shot, {extractFrames=true}={}) {
  const root=evidence.storageRoot(cfg),checks=[];
  const report={status:'BLOCKED',checks,frames:[],audio_status:'NOT_REVIEWED',scope:'技术检查与抽帧；不证明动作连贯或对白正确'};
  try {
    const stored=video.local_path || video.video_url;
    const before=evidence.fingerprint(root,stored),file=evidence.localFile(root,stored);
    report.file=before;
    const probe=JSON.parse(await command(getFfprobePath(),['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file],15000));
    const stream=probe.streams?.find(s=>s.codec_type==='video');
    const duration=Number(probe.format?.duration || stream?.duration);
    const expected=Number(shot.duration);
    if(!stream || !Number.isFinite(duration) || duration<=0 || duration>600)throw new Error('没有有效视频流或时长超出600秒检查范围');
    report.duration=duration;report.width=stream.width;report.height=stream.height;
    report.audio_present=probe.streams.some(s=>s.codec_type==='audio');
    checks.push({key:'duration',passed:expected>0 && Math.abs(duration-expected)<=Math.max(.5,expected*.1),evidence:`实际${duration.toFixed(3)}秒；要求${expected}秒`});
    checks.push({key:'resolution',passed:Math.min(stream.width,stream.height)>=720,evidence:`实际${stream.width}×${stream.height}；短边至少720`});
    const ratio=shot.aspect_ratio==='16:9'?16/9:shot.aspect_ratio==='1:1'?1:9/16;
    checks.push({key:'aspect_ratio',passed:Math.abs(stream.width/stream.height-ratio)<.06,evidence:`要求${shot.aspect_ratio || '9:16'}`});
    await command(getFfmpegPath(),['-nostdin','-v','error','-xerror','-protocol_whitelist','file,pipe','-i',file,'-map','0:v:0','-map','0:a?','-f','null','-'],90000);
    checks.push({key:'decode',passed:true,evidence:'完整视频/已有音轨解码成功'});
    for (const key of ['audio_local_path','narration_audio_local_path']) {
      if (!shot[key]) continue;
      const audioBefore=evidence.fingerprint(root,shot[key]),audio=evidence.localFile(root,shot[key]);
      const info=JSON.parse(await command(getFfprobePath(),['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',audio],15000));
      const audioDuration=Number(info.format?.duration);
      const valid=info.streams?.some(s=>s.codec_type==='audio') && audioDuration>0 && audioDuration<=expected+.5;
      checks.push({key,passed:Boolean(valid),evidence:`${key}实际${audioDuration}秒，镜头${expected}秒；只核对文件与时长，不代表对白正确`});
      if(valid)await command(getFfmpegPath(),['-nostdin','-v','error','-xerror','-protocol_whitelist','file,pipe','-i',audio,'-map','0:a:0','-f','null','-']);
      if(evidence.fingerprint(root,shot[key]).sha256!==audioBefore.sha256)throw new Error('配音在检查期间被修改');
    }
    if(extractFrames && checks.every(c=>c.passed)) {
      const dir=path.join(root,'agent-reviews',randomUUID());fs.mkdirSync(dir,{recursive:true});
      for(let i=0;i<6;i++) {
        const [num,den]=String(stream.avg_frame_rate || '25/1').split('/').map(Number);
        const fps=num>0 && den>0 ? num/den : 25;
        const time=Math.max(0,duration-Math.max(.15,2/fps))*i/5;
        const out=path.join(dir,`frame-${i}.jpg`);
        await command(getFfmpegPath(),['-nostdin','-v','error','-protocol_whitelist','file,pipe','-ss',String(time),'-i',file,'-frames:v','1','-vf','scale=480:-2','-q:v','3','-y',out],15000);
        report.frames.push({time:Number(time.toFixed(3)),...evidence.fingerprint(root,path.relative(root,out))});
      }
    }
    if(evidence.fingerprint(root,stored).sha256!==before.sha256)throw new Error('视频在检查期间被修改');
    report.status=checks.every(c=>c.passed)?'TECHNICAL_PASS':'BLOCKED';
    report.fallback=video.provider==='local_ffmpeg' || video.model==='ken_burns_fallback';
    if(report.fallback)report.warnings=['静帧运镜兜底，不代表人物动作视频'];
  } catch(err) {checks.push({key:'media_readable',passed:false,evidence:String(err.message).slice(0,2000)});report.status='BLOCKED';}
  return report;
}
function selectedVideo(db,run,shot) {
  const row=db.prepare("SELECT * FROM video_generations WHERE drama_id=? AND status='completed' AND deleted_at IS NULL AND (video_url=? OR local_path=? OR '/static/'||local_path=?) ORDER BY id DESC LIMIT 1").get(run.project_id,shot.video_url,shot.video_url,shot.video_url);
  return row || {video_url:shot.video_url,provider:'manual'};
}
function snapshot(db,run,cfg) {
  const shots=db.prepare(`SELECT s.id,s.episode_id,s.title,s.description,s.action,s.dialogue,s.narration,s.duration,s.video_prompt,s.video_url,s.audio_local_path,s.narration_audio_local_path FROM storyboards s JOIN episodes e ON e.id=s.episode_id WHERE e.drama_id=? AND s.deleted_at IS NULL AND e.deleted_at IS NULL ORDER BY e.episode_number,s.storyboard_number,s.id`).all(run.project_id);
  for (const shot of shots) {const video=selectedVideo(db,run,shot);shot.selected_video_id=video.id || null;shot.selected_local_path=video.local_path || video.video_url;}
  const files=evidence.manifest(evidence.storageRoot(cfg),shots.flatMap(s=>[{key:`video:${s.id}`,path:s.selected_local_path},...['audio_local_path','narration_audio_local_path'].filter(k=>s[k]).map(k=>({key:`${k}:${s.id}`,path:s[k]}))]));
  return {shots,files,digest:evidence.digest({shots,files})};
}
function assertReady(db,run,approved,cfg) {
  if(run.dry_run)return;
  require('./agentImageGate').assertApproved(db,run,cfg);
  const current=snapshot(db,run,cfg);
  if(!current.shots.length || current.files.some(f=>f.error))throw new Error('视频/配音文件缺失或不可核验，请局部修复后重新审核');
  if(!approved?.media_digest || current.digest!==approved.media_digest)throw new Error('视频或配音版本已变化，或旧审批没有文件指纹，请重新审核');
  if(!approved.inspections?.length || current.shots.some(s=>!approved.inspections.some(i=>i.shot_id===s.id && i.report.status==='TECHNICAL_PASS')))throw new Error('视频技术检查未全部通过，不能合成导出');
}
function assertApproved(db,run,cfg) {
 const row=db.prepare("SELECT snapshot_json FROM approval_requests WHERE run_id=? AND approval_stage='final_video' AND status='APPROVED' ORDER BY resolved_at DESC,rowid DESC LIMIT 1").get(run.id);
 if(!row)throw new Error('视频必须先审核通过才能合成');
 assertReady(db,run,JSON.parse(row.snapshot_json),cfg);
}
module.exports={selectedVideo,inspect,snapshot,assertReady,assertApproved,command};
