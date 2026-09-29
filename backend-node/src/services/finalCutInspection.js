const {command}=require('./agentVideoInspection');
const {getFfmpegPath,getFfprobePath}=require('../utils/ffmpegPath');
const evidence=require('./agentMediaEvidence');
function intervals(text,prefix,duration) {
 const rows=[];let start=null;
 for(const line of text.split('\n')) {
  const m=line.match(new RegExp(`^lavfi\\.${prefix}\\.(start|end)=(\\d+(?:\\.\\d+)?)$`)) ||
    line.match(new RegExp(`^lavfi\\.${prefix}_(start|end)=(\\d+(?:\\.\\d+)?)$`));
  if(!m)continue;
  if(m[1]==='start')start=Number(m[2]);
  else if(start!==null){rows.push({start,end:Number(m[2])});start=null;}
 }
 if(start!==null)rows.push({start,end:duration});
 return rows;
}
async function inspect(cfg,stored) {
 const root=evidence.storageRoot(cfg),before=evidence.fingerprint(root,stored),file=evidence.localFile(root,stored);
 const probe=JSON.parse(await command(getFfprobePath(),['-v','error','-show_streams','-show_format','-of','json',file]));
 const duration=Number(probe.format?.duration);
 if(!(duration>0&&duration<=600))throw Error('成片扫描仅支持0至600秒');
 const audio=probe.streams.some(s=>s.codec_type==='audio');
 const common=['-nostdin','-v','error','-xerror','-protocol_whitelist','file,pipe','-i',file];
 const visual=await command(getFfmpegPath(),[...common,'-an','-vf','freezedetect=n=-50dB:d=1,blackdetect=d=0.2:pix_th=0.10,metadata=mode=print:file=-','-f','null','-'],180000);
 const sound=audio?await command(getFfmpegPath(),[...common,'-vn','-af','silencedetect=n=-45dB:d=0.4,ametadata=mode=print:file=-','-f','null','-'],180000):'';
 if(evidence.fingerprint(root,stored).sha256!==before.sha256)throw Error('扫描期间文件变化');
 return {schema_version:1,file:before,duration,coverage:{video_decode_seconds:duration,audio_decode_seconds:audio?duration:0},
  signals:{freeze:intervals(visual,'freezedetect.freeze',duration),black:intervals(visual,'black',duration),silence:intervals(sound,'silence',duration)},
  audio_present:audio,status:'REQUIRES_CONTENT_REVIEW',scope:'完整解码与异常区间定位；静止/黑场/静音可能是创作意图，不自动判错；不证明动作、口型、语义或音质合格'};
}
module.exports={inspect,intervals};
