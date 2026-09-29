const { createHash } = require('node:crypto');
const evidence = require('./agentMediaEvidence');
function snapshot(db, projectId, cfg) {
  const shots = db.prepare(`SELECT s.id,s.episode_id,s.storyboard_number,s.title,s.description,s.action,s.dialogue,s.narration,s.duration,s.characters,s.continuity_snapshot,s.scene_id,s.image_prompt,s.video_prompt,s.image_url,s.local_path,s.first_frame_image_id,s.last_frame_image_id,s.last_frame_image_url,s.last_frame_local_path
    FROM storyboards s JOIN episodes e ON e.id=s.episode_id WHERE e.drama_id=? AND e.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY e.episode_number,s.storyboard_number,s.id`).all(projectId);
  const episodes = db.prepare('SELECT id,script_content FROM episodes WHERE drama_id=? AND deleted_at IS NULL ORDER BY id').all(projectId);
  const characters = db.prepare('SELECT id,name,appearance,identity_anchors,image_url,local_path FROM characters WHERE drama_id=? AND deleted_at IS NULL ORDER BY id').all(projectId);
  const scenes = db.prepare('SELECT id,location,time,prompt,image_url,local_path FROM scenes WHERE drama_id=? AND deleted_at IS NULL ORDER BY id').all(projectId);
  const props = db.prepare('SELECT id,name,description,prompt,image_url,local_path FROM props WHERE drama_id=? AND deleted_at IS NULL ORDER BY id').all(projectId);
  const links = db.prepare('SELECT sp.* FROM storyboard_props sp JOIN storyboards s ON s.id=sp.storyboard_id JOIN episodes e ON e.id=s.episode_id WHERE e.drama_id=? ORDER BY sp.storyboard_id,sp.prop_id').all(projectId);
  const entries = shots.flatMap(s => [
    {key:`shot:${s.id}:first`,path:s.local_path || s.image_url},
    ...(s.last_frame_local_path || s.last_frame_image_url ? [{key:`shot:${s.id}:last`,path:s.last_frame_local_path || s.last_frame_image_url}] : []),
  ]);
  for (const [type, rows] of [['character',characters],['scene',scenes],['prop',props]]) {
    for (const row of rows) if (row.local_path || row.image_url) entries.push({key:`${type}:${row.id}`,path:row.local_path || row.image_url});
  }
  const files = evidence.manifest(evidence.storageRoot(cfg),entries);
  return { files, file_digest: evidence.digest(files), shots, digest: createHash('sha256').update(JSON.stringify({shots,episodes,characters,scenes,props,links})).digest('hex'), images_completed: shots.filter(s=>s.local_path || s.image_url).length, total:shots.length, semantic_review:'HUMAN_REQUIRED', warnings:['此处只检查记录齐全与版本一致；请查看实际图片确认人物、道具、构图。没有视觉模型结论。'] };
}
function assertReady(db, run, approvedSnapshot, cfg) {
 const current=snapshot(db,run.project_id,cfg);
 if (!current.total || (!run.dry_run && current.images_completed!==current.total)) throw new Error('必须补齐全部分镜图片后才能进入视频阶段');
 if (!approvedSnapshot?.digest || current.digest!==approvedSnapshot.digest) throw new Error('图片或上游剧本、角色、分镜已变化，必须重新审核当前版本');
 if (!run.dry_run) {
   if (current.files.some(f=>f.error)) throw new Error('本地图片不可核验：' + current.files.filter(f=>f.error).map(f=>`${f.key} ${f.error}`).join('；'));
   if (!approvedSnapshot.file_digest || current.file_digest !== approvedSnapshot.file_digest) throw new Error('图片文件内容已变化或旧审核没有文件指纹，必须重新审核');
 }
 return current;
}
function assertApproved(db,run,cfg) {
 const row=db.prepare("SELECT snapshot_json FROM approval_requests WHERE run_id=? AND approval_stage='images' AND status='APPROVED' ORDER BY resolved_at DESC,rowid DESC LIMIT 1").get(run.id);
 if(!row) throw new Error('分镜图片必须先审核通过，不能直接生成视频');
 return assertReady(db,run,JSON.parse(row.snapshot_json),cfg);
}
module.exports={snapshot,assertReady,assertApproved};
