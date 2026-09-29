function ids(value) {
  try { const a = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(a) ? a.map(x => Number(x?.id ?? x)).filter(Number.isFinite) : []; } catch { return []; }
}
function speaker(shot, characters) {
  const text = String(shot.dialogue || '').trim();
  const labels = [...text.matchAll(/(?:^|\n)\s*([^：:\n]{1,40})[：:]/g)].map(x => x[1].trim());
  if (labels.length) {
    const matches = labels.map(name => characters.find(c => c.name === name));
    if (matches.some(x => !x) || new Set(matches.map(x => x.id)).size !== 1) throw new Error('对白说话者不明确或包含多人，请拆为单说话者镜头并使用「角色名：对白」');
    return matches[0];
  }
  const cast = characters.filter(c => ids(shot.characters).includes(Number(c.id)));
  if (cast.length !== 1) throw new Error('请在对白中明确「角色名：对白」，不能用出场角色顺序猜测说话者');
  return cast[0];
}
function audioJobs(shot, characters, config) {
  const jobs = [];
  let settings = {}; try { settings = typeof config.settings === 'object' ? config.settings : JSON.parse(config.settings || '{}'); } catch {}
  if (String(shot.dialogue || '').trim()) {
    const c = speaker(shot, characters);
    if (!c.tts_voice_id || c.tts_provider !== config.provider) throw new Error(`请为角色「${c.name}」设置当前供应商 ${config.provider} 的配音音色`);
    jobs.push({ text: shot.dialogue.replace(/(^|\n)\s*[^：:\n]{1,40}[：:]\s*/g, '$1').trim(), voice_id: c.tts_voice_id, column: 'audio_local_path' });
  }
  if (String(shot.narration || '').trim()) {
    const voice = config.voice_id || settings.voice_id;
    if (!voice) throw new Error('请在AI配置的TTS配置中设置旁白音色');
    jobs.push({text: shot.narration, voice_id: voice, column: 'narration_audio_local_path'});
  }
  return jobs;
}
function referenceVoice(shot, characters, voiceMap) {
  if (!String(shot.dialogue || '').trim()) return null;
  const c = speaker(shot, characters);
  if (!voiceMap.has(Number(c.id))) throw new Error(`角色「${c.name}」缺少有效的视频音色参考，请先设置音色参考`);
  return voiceMap.get(Number(c.id));
}
function assertShot(shot) {
  const fields = [['景别',shot.shot_type],['机位',shot.angle || (shot.angle_h && shot.angle_v && shot.angle_s)],['运镜（可填固定）',shot.movement],['场景',shot.location || shot.scene_id],['动作',shot.action],['动作结果',shot.result],['光影',shot.lighting_style]];
  const missing = fields.filter(([,v]) => !String(v ?? '').trim()).map(([k])=>k);
  if (!(Number(shot.duration) > 0)) missing.push('有效时长');
  if (missing.length) throw new Error(`镜头${shot.storyboard_number || shot.id}生成前检查：请补充${missing.join('、')}`);
}
module.exports = { speaker, audioJobs, referenceVoice, assertShot };
