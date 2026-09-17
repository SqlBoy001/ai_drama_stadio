const SCREEN_DEVICE_RE = /手机|智能机|平板|电脑|显示器|屏幕|手表|腕表/i;
const PLOT_SCREEN_INFO_RE = /弹幕|直播(?:间|界面)?|短信|消息|通知|来电|倒计时|警告|预警|屏幕(?:上|里|中|内容)|界面(?:上|里|中)|文字(?:显示|滚动|闪烁)|聊天记录|监控画面|导航路线|二维码/i;
const HUMAN_REACTION_RE = /脸|面部|表情|神情|眼|瞳孔|视线|抬头|低头|僵住|愣住|震惊|惊疑|惊恐|害怕|皱眉|流泪|哭|笑|反应/i;
const CONTRACT_MARKER = '【手机信息双层构图最高优先级】';

function storyboardText(storyboard) {
  if (!storyboard || typeof storyboard !== 'object') return '';
  return [
    storyboard.title,
    storyboard.description,
    storyboard.action,
    storyboard.result,
    storyboard.atmosphere,
    storyboard.dialogue,
    storyboard.image_prompt,
    storyboard.video_prompt,
  ].filter(Boolean).join('。');
}

function extractQuotedScreenTexts(text) {
  const matches = [];
  const quoteRe = /["“'‘]([^"”'’\n]{1,24})["”'’]/g;
  let match;
  while ((match = quoteRe.exec(text)) && matches.length < 3) {
    const value = String(match[1] || '').trim();
    if (value && !matches.includes(value)) matches.push(value);
  }
  return matches;
}

function detectScreenContentComposition(storyboard) {
  const text = storyboardText(storyboard);
  const required = SCREEN_DEVICE_RE.test(text)
    && PLOT_SCREEN_INFO_RE.test(text)
    && HUMAN_REACTION_RE.test(text);
  return {
    required,
    screenTexts: required ? extractQuotedScreenTexts(text) : [],
  };
}

function buildScreenContentCompositionContract(storyboard, kind = 'image') {
  const detection = detectScreenContentComposition(storyboard);
  if (!detection.required) return '';
  const textRequirement = detection.screenTexts.length
    ? `浮层只展示剧情指定信息：“${detection.screenTexts.join('”“')}”，使用简短、高对比、清晰可读的中文，不添加其他文字。`
    : '浮层只展示剧情明确指定的屏幕信息，文字简短、高对比、清晰可读，不添加剧情外内容。';
  const motionRequirement = kind === 'video'
    ? '整个视频中浮层固定在画面坐标，不随手中实体手机移动、翻转、缩放或发生透视变形；允许短暂淡入和内容滚动，但边框位置稳定、文字不漂移。'
    : '这是同一完整画面中的非实体影视信息图层，不是分屏、拼贴或第二部手机。';
  return `${CONTRACT_MARKER}主画面优先清晰呈现人物正面近景/特写与真实表情，人物偏向一侧，另一侧保留干净的侧边负空间；在侧边负空间叠加独立手机界面UI浮层，正面朝向观众且不遮挡人物脸部。${textRequirement}${motionRequirement}人物手中的实体手机保持正常真实尺寸，屏幕朝向人物并遵守真实透视，主机位无需同时看见实体屏幕内容；若镜头可见实体手机背面，手机背壳必须完全不发光、无文字、无界面、无图像。禁止把屏幕内容画在手机背壳，禁止透明手机、双面屏、镜像文字、额外手机、额外手指。`;
}

function applyScreenContentComposition(prompt, storyboard, kind = 'image') {
  const base = String(prompt || '').trim();
  if (!base || base.includes(CONTRACT_MARKER)) return base;
  const contract = buildScreenContentCompositionContract(storyboard, kind);
  return contract ? `${base}\n${contract}` : base;
}

function getStoryboard(db, storyboardId) {
  return db.prepare(
    `SELECT * FROM storyboards WHERE id = ? AND deleted_at IS NULL`
  ).get(Number(storyboardId));
}

function applyStoryboardScreenComposition(db, storyboardId, prompt, kind = 'image') {
  const storyboard = getStoryboard(db, storyboardId);
  return storyboard ? applyScreenContentComposition(prompt, storyboard, kind) : String(prompt || '').trim();
}

function latestCompletedPrompt(db, table, storyboardId) {
  try {
    return db.prepare(
      `SELECT prompt FROM ${table} WHERE storyboard_id = ? AND status = 'completed' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`
    ).get(Number(storyboardId));
  } catch (_) {
    return null;
  }
}

function auditEpisodeScreenComposition(db, episodeId, options = {}) {
  const apply = options.apply === true;
  const episode = db.prepare(
    'SELECT id FROM episodes WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(episodeId));
  if (!episode) throw new Error('剧集不存在');

  const rows = db.prepare(
    `SELECT * FROM storyboards
     WHERE episode_id = ? AND deleted_at IS NULL
     ORDER BY storyboard_number ASC, id ASC`
  ).all(Number(episodeId));
  const affectedIds = [];
  const affectedNumbers = [];
  const regenerateImageIds = [];
  const regenerateImageNumbers = [];
  const regenerateVideoIds = [];
  const regenerateVideoNumbers = [];
  const updates = [];

  for (const row of rows) {
    const detection = detectScreenContentComposition(row);
    if (!detection.required) continue;
    const imagePrompt = applyScreenContentComposition(row.image_prompt || row.description || row.action, row, 'image');
    const videoPrompt = applyScreenContentComposition(row.video_prompt || row.action || row.description, row, 'video');
    const polishedPrompt = row.polished_prompt
      ? applyScreenContentComposition(row.polished_prompt, row, 'image')
      : row.polished_prompt;
    if (imagePrompt !== row.image_prompt || videoPrompt !== row.video_prompt || polishedPrompt !== row.polished_prompt) {
      affectedIds.push(row.id);
      affectedNumbers.push(row.storyboard_number);
      updates.push({ id: row.id, imagePrompt, videoPrompt, polishedPrompt });
    }

    const imageGen = latestCompletedPrompt(db, 'image_generations', row.id);
    if (imageGen && !String(imageGen.prompt || '').includes(CONTRACT_MARKER)) {
      regenerateImageIds.push(row.id);
      regenerateImageNumbers.push(row.storyboard_number);
    } else if (!imageGen && (row.image_url || row.local_path) && !String(row.image_prompt || '').includes(CONTRACT_MARKER)) {
      regenerateImageIds.push(row.id);
      regenerateImageNumbers.push(row.storyboard_number);
    }

    const videoGen = latestCompletedPrompt(db, 'video_generations', row.id);
    if (videoGen && !String(videoGen.prompt || '').includes(CONTRACT_MARKER)) {
      regenerateVideoIds.push(row.id);
      regenerateVideoNumbers.push(row.storyboard_number);
    } else if (!videoGen && row.video_url && !String(row.video_prompt || '').includes(CONTRACT_MARKER)) {
      regenerateVideoIds.push(row.id);
      regenerateVideoNumbers.push(row.storyboard_number);
    }
  }

  if (apply && updates.length) {
    const stmt = db.prepare(
      'UPDATE storyboards SET image_prompt = ?, video_prompt = ?, polished_prompt = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL'
    );
    db.transaction(() => {
      const now = new Date().toISOString();
      for (const item of updates) {
        stmt.run(item.imagePrompt, item.videoPrompt, item.polishedPrompt, now, item.id);
      }
    })();
  }

  return {
    episode_id: Number(episodeId),
    applied: apply,
    checked_storyboards: rows.length,
    affected_storyboard_ids: affectedIds,
    affected_storyboard_numbers: affectedNumbers,
    regenerate_storyboard_ids: regenerateImageIds,
    regenerate_storyboard_numbers: regenerateImageNumbers,
    regenerate_video_storyboard_ids: regenerateVideoIds,
    regenerate_video_storyboard_numbers: regenerateVideoNumbers,
  };
}

module.exports = {
  CONTRACT_MARKER,
  detectScreenContentComposition,
  buildScreenContentCompositionContract,
  applyScreenContentComposition,
  applyStoryboardScreenComposition,
  auditEpisodeScreenComposition,
};
