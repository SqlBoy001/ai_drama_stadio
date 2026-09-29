// Explicit, local-only replay-provider acceptance harness. No real credentials.
// Production routes/parsers/tasks/approvals run normally; provider outputs are
// known fixtures. Never use this report as novel model-output quality evidence.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),backend=path.join(root,'backend-node');
const dir=path.join(backend,'data/acceptance/new-case-20260921'),port=5687;
if(!process.argv.includes('--start'))throw Error('Use --start for the explicit isolated replay test');
fs.mkdirSync(dir,{recursive:true});
const cfg={app:{name:'零付费回放验收',version:'case1'},server:{host:'127.0.0.1',port},database:{path:path.join(dir,'isolated.db'),type:'sqlite'},storage:{local_path:dir},ai:{}};
require(path.join(backend,'src/config')).loadConfig=()=>cfg;
const {command}=require(path.join(backend,'src/services/agentVideoInspection')),{getFfmpegPath}=require(path.join(backend,'src/utils/ffmpegPath'));
const original=JSON.parse(fs.readFileSync(path.join(backend,'data/production/今天重来-v02/production-manifest.json')));
const selected=[1,3,4,9,11,12].map(n=>original.shots[n-1]);
const title='【零付费回放验收】最后一通电话';
const chars=[{name:'李默',role:'protagonist',appearance:'年轻清瘦男性，黑色短发，深蓝西装、白衬衫，无领带',personality:'主动求证',description:'被要求当天离职的员工'},{name:'主管',role:'antagonist',appearance:'成熟男性，浅蓝衬衫，深色长裤，挂工牌',personality:'强势控制',description:'阻止员工直接联系客户'}];
function audit(type,data){fs.appendFileSync(path.join(dir,'provider-audit.jsonl'),JSON.stringify({at:new Date().toISOString(),type,...data})+'\n');}
function number(prompt){const n=String(prompt).match(/CASE-S(\d+)/)?.[1];if(!n)throw Error('Replay request missing stable shot marker');return Number(n);}
const ai=require(path.join(backend,'src/services/aiClient'));
ai.generateText=async(db,log,type,prompt,system,opts={})=>{
 const key=opts.scene_key||'';audit('text',{key,prompt,system});
 if(type!=='text')throw Error('Replay provider has no independent semantic review model');
 if(key==='story_generation')return JSON.stringify([{episode:1,title,content:selected.map((s,i)=>`场${i+1} ${i*5}–${i*5+5}秒｜${s.title}\n动作：${s.prompt}\n旁白：${s.narration}`).join('\n\n')+'\n尾钩子：客户通过了，主管为什么一直不许他联系客户？'}]);
 if(key==='role_extraction')return JSON.stringify(chars);
 if(key==='identity_anchors')return JSON.stringify({face:'固定人物身份',hair:'短黑发',color_anchors:{outfit:prompt.includes('主管')?'浅蓝':'深蓝'}});
 if(key==='scene_extraction')return JSON.stringify([{location:'办公室',time:'白天',prompt:'现代办公室与相邻楼梯间，冷白光，内部回放参考'}]);
 if(key==='prop_extraction')return JSON.stringify([{name:'方案纸张',type:'文件',description:'白色纸张',image_prompt:'白色方案文件纸张'}]);
 if(key==='storyboard_extraction'){
  const cs=db.prepare('SELECT id,name FROM characters WHERE deleted_at IS NULL ORDER BY id').all();const scene=db.prepare('SELECT id FROM scenes WHERE deleted_at IS NULL ORDER BY id LIMIT 1').get();
  return JSON.stringify(selected.map((s,i)=>({shot_number:i+1,title:s.title,duration:5,location:'办公室',time:'白天',scene_id:scene?.id,characters:cs.filter(c=>s.character_ids.includes(c.name==='李默'?11:12)).map(c=>c.id),shot_type:'中景',movement:'固定',action:`CASE-S${i+1} ${s.prompt}`,result:s.title,dialogue:'',narration:s.narration,atmosphere:'紧张'})));
 }
 if(!key&&system.includes('beats:'))return JSON.stringify({title,logline:'被通知离职的员工绕开主管联系客户，方案通过，却发现主管一直在阻拦。',beats:selected.map(s=>s.narration),characters:chars.map(c=>({name:c.name,visual_anchor:c.appearance}))});
 if(!key || ['image_prompt','scene_prompt','character_prompt','prop_prompt','role_image_polish','prop_image_polish'].includes(key))return '内部回放素材参考，固定人物与原镜头构图。'+prompt;
 throw Error('Unsupported replay text request: '+key);
};
ai.generateTextWithVision=async()=>{throw Error('Replay fixture does not claim AI semantic approval');};
require(path.join(backend,'src/services/videoClient')).callVideoApi=async(db,log,opts)=>{const n=number(opts.prompt);audit('video',{n});return {video_url:`http://127.0.0.1:${port}/fixtures/clip${n}.mp4`};};
require(path.join(backend,'src/services/ttsService')).synthesize=async(db,log,{text,storyboard_id})=>{
 const shot=db.prepare('SELECT storyboard_number FROM storyboards WHERE id=?').get(storyboard_id),n=shot.storyboard_number;
 if(text!==selected[n-1].narration)throw Error('Replay narration differs from fixture');audit('voice',{n,text});return {local_path:`voice${n}.wav`,audio_url:`/static/voice${n}.wav`};
};
(async()=>{
 for(let i=0;i<selected.length;i++){
  const n=i+1,s=selected[i];const video=path.join(dir,`clip${n}.mp4`),frame=path.join(dir,`frame${n}.jpg`),voice=path.join(dir,`voice${n}.wav`);
  if(!fs.existsSync(video))await command(getFfmpegPath(),['-v','error','-i',path.join(backend,'data/storage',s.local_path),'-t','5','-vf','scale=720:1280,fps=30','-an','-c:v','libx264','-preset','fast','-crf','20','-n',video]);
  if(!fs.existsSync(frame))await command(getFfmpegPath(),['-v','error','-ss','0.5','-i',video,'-frames:v','1','-n',frame]);
  if(!fs.existsSync(voice))await command(getFfmpegPath(),['-v','error','-i',path.join(backend,'data/production/今天重来-v02/audio-v02',`${String(s.sequence).padStart(2,'0')}.aiff`),'-c:a','pcm_s16le','-n',voice]);
 }
 process.env.WEB_DIST_PATH=path.join(root,'frontweb/dist');
 const {app,db}=require(path.join(backend,'src/app')).createApp();
 if(!db.prepare('SELECT id FROM ai_service_configs LIMIT 1').get())for(const type of ['text','image','storyboard_image','video','tts'])db.prepare('INSERT INTO ai_service_configs(service_type,provider,name,base_url,api_key,model,default_model,is_active,is_default) VALUES(?,?,?,?,?,?,?,1,1)').run(type,'openai','本地回放，无付费API',`http://127.0.0.1:${port}/replay`,'local-fixture-only',JSON.stringify([type.includes('image')?'gpt-image-1':'replay-fixture']),type.includes('image')?'gpt-image-1':'replay-fixture');
 // App's catch-all is mounted before these routes: use a separate local fixture
 // provider server so no production routing order needs to be bypassed.
 const express=require(path.join(backend,'node_modules/express')),provider=express();provider.use(express.json({limit:'20mb'}));
 provider.use('/fixtures',express.static(dir));
 provider.post('/replay/images/generations',(req,res)=>{let n=1;try{n=number(req.body.prompt)}catch{if(String(req.body.prompt).includes('主管'))n=2;}audit('image',{n,prompt:req.body.prompt});res.json({data:[{url:`http://127.0.0.1:5688/fixtures/frame${n}.jpg`}]});});
 // Media client output URLs must address the local fixture server as well.
 require(path.join(backend,'src/services/videoClient')).callVideoApi=async(db,log,opts)=>{const n=number(opts.prompt);audit('video',{n});return {video_url:`http://127.0.0.1:5688/fixtures/clip${n}.mp4`};};
 db.prepare('UPDATE ai_service_configs SET base_url=?').run('http://127.0.0.1:5688/replay');
 provider.listen(5688,'127.0.0.1');app.listen(port,'127.0.0.1',()=>console.log(`CASE READY http://127.0.0.1:${port}/create`));
 fs.writeFileSync(path.join(dir,'case-manifest.json'),JSON.stringify({title,mode:'local-replay-provider',paid_calls:0,source_shots:selected.map(s=>s.sequence),duration:30,limits:['复用旧镜头及录音，局部升采样到720p；不是原生720p新生成质量证明','所有审批必须走真实API/页面，不直接改审批状态']},null,2));
})();
