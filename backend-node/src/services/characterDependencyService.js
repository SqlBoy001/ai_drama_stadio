const crypto=require('crypto');
const fields=['image_prompt','polished_prompt','video_prompt','layout_description','universal_segment_text'];
function parse(v,f){try{return typeof v==='string'?JSON.parse(v):v||f}catch{return f}}
function digest(c){return crypto.createHash('sha256').update(JSON.stringify([c.name,c.appearance,c.local_path,c.image_url])).digest('hex')}
function sync(db,old,current){
 const rows=db.prepare('SELECT s.* FROM storyboards s JOIN episodes e ON e.id=s.episode_id WHERE e.drama_id=? AND s.deleted_at IS NULL').all(current.drama_id);
 for(const s of rows){
  const ids=parse(s.characters,[]).map(x=>Number(x?.id??x));if(!ids.includes(Number(current.id)))continue;
  const snapshot=parse(s.continuity_snapshot,{}),state=parse(s.character_dependency_state,{});const locks=Array.isArray(snapshot.characters)?snapshot.characters.filter(c=>c.name===old.name||c.name===current.name).map(c=>c.appearance_lock).filter(Boolean):[];
  if(old.appearance)locks.push(old.appearance);
  const patch={},conflicts=[];
  for(const f of fields){let text=s[f];if(!text)continue;let changed=false;
   for(const lock of [...new Set(locks)].sort((a,b)=>b.length-a.length)){if(lock!==current.appearance&&text.includes(lock)){text=text.split(lock).join(current.appearance||'');changed=true}}
   if(old.appearance!==current.appearance&&!changed&&!text.includes(current.appearance||'\0'))conflicts.push(f);
   patch[f]=text;
  }
  if(Array.isArray(snapshot.characters))for(const c of snapshot.characters)if(c.name===old.name||c.name===current.name)c.appearance_lock=current.appearance;
  state.invalidated_at=new Date().toISOString();state.characters=state.characters||{};state.characters[current.id]=digest(current);state.conflicts=[...new Set([...(state.conflicts||[]),...conflicts])];state.notice=state.conflicts.length?'角色已更新，提示词存在无法自动替换的旧描述，请重写后再生成':'角色已更新，旧媒体已解除主引用，请重新生成并审核';
  const archive=parse(state.previous_media,[]);if(s.image_url||s.local_path||s.video_url)archive.push({at:new Date().toISOString(),image_url:s.image_url,local_path:s.local_path,video_url:s.video_url,first_frame_image_id:s.first_frame_image_id,last_frame_image_id:s.last_frame_image_id});state.previous_media=archive;
  patch.continuity_snapshot=JSON.stringify(snapshot);patch.character_dependency_state=JSON.stringify(state);
  db.prepare('UPDATE storyboards SET '+Object.keys(patch).map(k=>k+'=?').join(',')+",image_url=NULL,local_path=NULL,video_url=NULL,first_frame_image_id=NULL,last_frame_image_id=NULL,last_frame_image_url=NULL,last_frame_local_path=NULL,status='draft',updated_at=? WHERE id=?").run(...Object.values(patch),new Date().toISOString(),s.id);
 }
}
function assertCurrent(db,id,video=false){if(!id)return;const s=db.prepare('SELECT * FROM storyboards WHERE id=?').get(id);if(!s)return;const state=parse(s.character_dependency_state,{});if(state.conflicts?.length)throw Error(state.notice);
 const ids=parse(s.characters,[]).map(x=>Number(x?.id??x));const snapshot=parse(s.continuity_snapshot,{});
 for(const cid of ids){const c=db.prepare('SELECT * FROM characters WHERE id=? AND deleted_at IS NULL').get(cid);if(!c)continue;
  if(state.characters?.[cid]&&state.characters[cid]!==digest(c))throw Error('角色版本已改变，请先同步分镜再生成');
  const lock=Array.isArray(snapshot.characters)?snapshot.characters.find(x=>x.name===c.name)?.appearance_lock:null;
  if(lock&&lock!==c.appearance)throw Error('角色描述与分镜旧版本不一致，请先同步');
 }
 if(video&&state.notice&&!s.local_path&&!s.image_url)throw Error('角色已更新，请先生成并审核新版分镜图');
}
module.exports={sync,assertCurrent,digest};
