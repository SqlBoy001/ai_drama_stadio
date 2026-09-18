const { isAudioOnlyCharacter } = require('./shotPresence');
const LIBRARY_URL = 'https://docs.volcengine.com/docs/ark/avatar-library?lang=zh';
function normalizeAssetId(value) {
 const id=String(value||'').trim().replace(/^asset:\/\//,'');
 if(!/^asset-[a-zA-Z0-9-]+$/.test(id) || id.length>160) throw new Error('请输入官方虚拟人像库的 asset ID 或 asset:// URI');
 return id;
}
function bind(db,id,input) {
 if(!db.prepare('SELECT id FROM characters WHERE id=? AND deleted_at IS NULL').get(Number(id))) throw new Error('角色不存在');
 if(input.source_confirmed!==true) throw new Error('请确认资产来自官方预置虚拟人像库');
 const asset={asset_id:normalizeAssetId(input.asset_id),source:'volcengine_preset',status:'selected_unverified',selected_at:new Date().toISOString()};
 db.prepare('UPDATE characters SET official_avatar=?,updated_at=? WHERE id=?').run(JSON.stringify(asset),asset.selected_at,Number(id));
 return asset;
}
function plan(db,shotId) {
 const shot=db.prepare('SELECT s.*,e.drama_id FROM storyboards s JOIN episodes e ON e.id=s.episode_id WHERE s.id=? AND s.deleted_at IS NULL AND e.deleted_at IS NULL').get(Number(shotId));
 if(!shot) throw new Error('分镜不存在');
 let items;try{items=JSON.parse(shot.characters||'[]');}catch{throw new Error('分镜角色列表无效');}
 if(!Array.isArray(items)) throw new Error('分镜角色列表无效');
 const ids=[...new Set(items.map(x=>Number(x?.id??x)))];
 const refs=[],missing=[];
 for(const id of ids){
  const c=db.prepare('SELECT id,name,official_avatar FROM characters WHERE id=? AND drama_id=? AND deleted_at IS NULL').get(id,shot.drama_id);
  if(!c) throw new Error('分镜包含无效或跨项目角色');
  if(isAudioOnlyCharacter(shot,c.name)) continue;
  let a;try{a=JSON.parse(c.official_avatar||'null');}catch{}
  if(!a || a.source!=='volcengine_preset') {missing.push(c.name);continue;}
  refs.push({character_id:c.id,name:c.name,uri:'asset://'+normalizeAssetId(a.asset_id)});
 }
 if(!ids.length) missing.push('请先明确本镜出镜角色');
 if(refs.length>9) throw new Error('本路线每镜最多9个虚拟角色');
 return {status:missing.length || !refs.length?'BLOCKED':'READY_FOR_PROVIDER_CHECK',missing,library_url:LIBRARY_URL,references:refs,
 prompt:refs.map((r,i)=>`参考图片${i+1}中的人物是${r.name}，不得互换身份。`).join('\n')+'\n'+(shot.video_prompt||shot.action||''),
 note:'仅使用官方人像参考，不携带原自生成的人像首帧；原构图不会自动继承。资产是否可用仍需供应商校验，本操作不生成视频。'};
}
module.exports={bind,plan,normalizeAssetId};
