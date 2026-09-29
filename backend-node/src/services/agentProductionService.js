const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { getFfmpegPath, hasLocalFfmpeg } = require('../utils/ffmpegPath');
const storageLayout = require('./storageLayout');

const activeJobs = new Set();
const GENERATING_STATUSES = new Set(['SCRIPT_GENERATING', 'ASSET_GENERATING', 'IMAGE_GENERATING', 'MEDIA_GENERATING', 'MEDIA_REVIEWING', 'EXPORTING']);

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function getDefaultConfig(db, serviceType, fallbackType) {
  const aiConfigService = require('./aiConfigService');
  let configs = aiConfigService.listConfigs(db, serviceType).filter((item) => item.is_active);
  let usingFallback = false;
  if (!configs.length && fallbackType) {
    configs = aiConfigService.listConfigs(db, fallbackType).filter((item) => item.is_active);
    usingFallback = configs.length > 0;
  }
  const config = configs.find((item) => item.is_default) || configs[0] || null;
  return { config, usingFallback };
}

function getActiveConfigs(db, serviceType, fallbackType) {
  const aiConfigService = require('./aiConfigService');
  let configs = aiConfigService.listConfigs(db, serviceType).filter((item) => item.is_active);
  if (!configs.length && fallbackType) configs = aiConfigService.listConfigs(db, fallbackType).filter((item) => item.is_active);
  return configs;
}

function getActiveConfigsWithFallback(db, serviceType, fallbackType) {
  const primary = getActiveConfigs(db, serviceType);
  const fallback = fallbackType ? getActiveConfigs(db, fallbackType) : [];
  const seen = new Set();
  return [...primary, ...fallback].filter((item) => {
    const model = item.default_model || item.model?.[0] || '';
    const key = `${item.provider}:${model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isTerminalProviderError(error) {
  const text = String(error?.message || error || '').toLowerCase();
  return /modelnotopen|has not activated the model|not supported when using codex|invalid api key|unauthori[sz]ed|authentication|forbidden/.test(text);
}

function friendlyProviderError(error, model) {
  const text = String(error?.message || error || '未知错误');
  if (/modelnotopen|has not activated the model/i.test(text)) {
    return `火山方舟账号尚未开通模型 ${model || ''}，请在方舟控制台开通后重新生成。`.trim();
  }
  if (/not supported when using codex with a chatgpt account/i.test(text)) {
    return `当前 OpenAI 本地代理账号不支持 ${model || '所选图片模型'} 的生图调用，请更换图片供应商。`;
  }
  if (/invalid api key|unauthori[sz]ed|authentication|forbidden|does not exist or you do not have access/i.test(text)) {
    return `${model || 'AI 模型'} 鉴权失败，请检查 API Key 和账号权限。`;
  }
  return text.replace(/\s*Request id:.*$/i, '').slice(0, 300);
}

function publicConfig(serviceType, entry, required) {
  const config = entry.config;
  const models = config?.model || [];
  const model = config?.default_model || models[0] || '';
  const configured = Boolean(config && config.is_active && config.api_key && model);
  return {
    service_type: serviceType,
    label: ({ text: '剧本与分镜文本', image: '角色/场景图片', storyboard_image: '分镜关键帧', video: '动态视频', tts: '配音' })[serviceType] || serviceType,
    required,
    configured,
    provider: config?.provider || null,
    name: config?.name || null,
    model: model || null,
    using_fallback: entry.usingFallback,
  };
}

function getProviderStatus(db) {
  const capabilities = [
    publicConfig('text', getDefaultConfig(db, 'text'), true),
    publicConfig('image', getDefaultConfig(db, 'image'), true),
    publicConfig('storyboard_image', getDefaultConfig(db, 'storyboard_image', 'image'), true),
    publicConfig('video', getDefaultConfig(db, 'video'), true),
    publicConfig('tts', getDefaultConfig(db, 'tts'), false),
  ];
  const missingRequired = capabilities.filter((item) => item.required && !item.configured);
  const warnings = [];
  if (!capabilities.find((item) => item.service_type === 'tts')?.configured) {
    warnings.push('尚未配置配音模型，将使用字幕完成成片；可稍后在 AI 配置中补充 TTS。');
  }
  const recentModels = db.prepare(`SELECT model, status, error_msg, updated_at FROM image_generations
    WHERE model IS NOT NULL AND deleted_at IS NULL
    ORDER BY updated_at DESC LIMIT 50`).all();
  const latestByModel = new Map();
  for (const row of recentModels) if (!latestByModel.has(row.model)) latestByModel.set(row.model, row);
  const knownIssues = new Map();
  for (const row of latestByModel.values()) {
    if (row.status === 'failed' && isTerminalProviderError(row.error_msg)) {
      knownIssues.set(row.model, { message: friendlyProviderError(row.error_msg, row.model), updated_at: row.updated_at });
    }
  }
  for (const item of capabilities) {
    const issue = item.model ? knownIssues.get(item.model) : null;
    const configUpdated = item.model
      ? db.prepare('SELECT MAX(updated_at) AS updated_at FROM ai_service_configs WHERE deleted_at IS NULL AND default_model = ?').get(item.model)?.updated_at
      : null;
    if (issue && (!configUpdated || issue.updated_at >= configUpdated)) {
      item.known_issue = issue.message;
      warnings.push(issue.message);
    }
    const candidates = item.service_type === 'storyboard_image'
      ? getActiveConfigsWithFallback(db, 'storyboard_image', 'image')
      : getActiveConfigs(db, item.service_type);
    item.operational = item.configured && candidates.some((candidate) => {
      const model = candidate.default_model || candidate.model?.[0];
      const candidateIssue = model ? knownIssues.get(model) : null;
      return !candidateIssue || (candidate.updated_at && candidateIssue.updated_at < candidate.updated_at);
    });
  }
  const operationalReady = capabilities.filter((item) => item.required).every((item) => item.operational);
  return {
    ready: missingRequired.length === 0,
    operational_ready: operationalReady,
    capabilities,
    missing_required: missingRequired.map((item) => item.service_type),
    warnings,
  };
}

function getRunRow(db, runId) {
  const row = db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(runId);
  if (!row) return null;
  return { ...row, plan: parseJson(row.plan_json, {}) };
}

function updateRun(db, runId, status, currentStep) {
  db.prepare('UPDATE agent_runs SET status = ?, current_step = ?, updated_at = ? WHERE id = ?')
    .run(status, currentStep, new Date().toISOString(), runId);
}

function assertRunnable(db, runId) {
  const row = db.prepare('SELECT status FROM agent_runs WHERE id = ?').get(runId);
  if (!row) throw new Error('运行不存在');
  if (row.status === 'CANCELLED') {
    const err = new Error('运行已取消');
    err.code = 'RUN_STOPPED';
    throw err;
  }
  if (row.status === 'PAUSED') {
    const err = new Error('运行已暂停');
    err.code = 'RUN_STOPPED';
    throw err;
  }
}

function startStep(db, runId, key, type, input) {
  const idempotency = `${runId}:${key}`;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM agent_steps WHERE idempotency_key = ?').get(idempotency);
  if (existing) {
    db.prepare(`UPDATE agent_steps SET status = 'RUNNING', input_json = ?, error_code = NULL, error_message = NULL,
      retry_count = retry_count + 1, started_at = ?, completed_at = NULL WHERE id = ?`)
      .run(input ? JSON.stringify(input) : null, now, existing.id);
    return existing.id;
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO agent_steps
    (id, run_id, step_key, step_type, input_json, status, idempotency_key, started_at)
    VALUES (?, ?, ?, ?, ?, 'RUNNING', ?, ?)`).run(id, runId, key, type, input ? JSON.stringify(input) : null, idempotency, now);
  return id;
}

function completeStep(db, stepId, output) {
  db.prepare(`UPDATE agent_steps SET status = 'COMPLETED', output_json = ?, completed_at = ? WHERE id = ?`)
    .run(JSON.stringify(output || {}), new Date().toISOString(), stepId);
}

function failStep(db, stepId, err) {
  db.prepare(`UPDATE agent_steps SET status = 'FAILED', error_code = ?, error_message = ?, completed_at = ? WHERE id = ?`)
    .run(err.code || 'GENERATION_FAILED', String(err.message || err).slice(0, 1000), new Date().toISOString(), stepId);
}

function createApproval(db, runId, projectId, stage, snapshot) {
  const existing = db.prepare("SELECT id FROM approval_requests WHERE run_id = ? AND approval_stage = ? AND status = 'PENDING'").get(runId, stage);
  if (existing) return existing.id;
  const id = uuidv4();
  db.prepare(`INSERT INTO approval_requests
    (id, run_id, project_id, target_type, target_id, approval_stage, snapshot_json, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`)
    .run(id, runId, projectId, stage === 'final_video' ? 'video' : stage, String(projectId), stage, JSON.stringify(snapshot || {}), new Date().toISOString());
  return id;
}

function failRun(db, log, runId, action, stepId, err) {
  if (stepId) failStep(db, stepId, err);
  const row = db.prepare('SELECT status FROM agent_runs WHERE id = ?').get(runId);
  if (row && row.status !== 'CANCELLED' && row.status !== 'PAUSED') updateRun(db, runId, 'FAILED', `failed:${action}`);
  log.error('Agent real production failed', { run_id: runId, action, error: err.message });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitTask(db, runId, taskId, label, timeoutMs = 30 * 60 * 1000) {
  const taskService = require('./taskService');
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    assertRunnable(db, runId);
    const task = taskService.getTask(db, taskId);
    if (!task) throw new Error(`${label}任务不存在`);
    if (task.status === 'completed') return parseJson(task.result, {});
    if (task.status === 'failed') throw new Error(`${label}失败：${task.error || task.message || '未知错误'}`);
    await wait(1000);
  }
  throw new Error(`${label}等待超时，可点击重试继续`);
}

async function runLimited(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { ok: true, value: await worker(items[index], index) }; }
      catch (error) { results[index] = { ok: false, error }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

function episodeSnapshot(db, projectId) {
  return db.prepare(`SELECT id, episode_number, title, script_content, description
    FROM episodes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY episode_number`).all(projectId);
}

function joinText(left, right, separator = '\n') {
  return [left, right].map((value) => String(value || '').trim()).filter(Boolean).join(separator);
}

function mergeImagePrompts(left, right) {
  const primary = String(left || '').trim();
  const secondary = String(right || '').trim();
  return [
    '单镜头完整画幅，禁止分屏、拼贴、漫画分格、前后对比和画中画。',
    primary,
    secondary ? `在同一画面中自然融入后续动作：${secondary}` : '',
  ].filter(Boolean).join(' ');
}

function mergeJsonArrays(left, right) {
  const values = [...parseJson(left, []), ...parseJson(right, [])];
  return JSON.stringify([...new Set(values)]);
}

function chooseStoryboardMergeIndex(rows) {
  const center = (rows.length - 1) / 2;
  let selected = 0;
  let selectedScore = -Infinity;
  for (let index = 0; index < rows.length - 1; index += 1) {
    const left = rows[index];
    const right = rows[index + 1];
    const sameScene = left.scene_id && Number(left.scene_id) === Number(right.scene_id);
    const boundaryPenalty = index === 0 || index + 1 === rows.length - 1 ? 30 : 0;
    const dialogueBonus = Boolean(left.dialogue) !== Boolean(right.dialogue) ? 8 : 0;
    const score = (sameScene ? 100 : 0) + dialogueBonus - Math.abs(index + 0.5 - center) * 10 - boundaryPenalty;
    if (score > selectedScore) {
      selected = index;
      selectedScore = score;
    }
  }
  return selected;
}

function normalizeEpisodeStoryboards(db, episodeId, targetCount, totalDuration) {
  const target = Math.max(1, Number(targetCount) || 1);
  const duration = Math.max(target, Number(totalDuration) || target * 5);
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    let rows = db.prepare(`SELECT * FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL
      ORDER BY storyboard_number, id`).all(episodeId);
    let merged = 0;
    while (rows.length > target) {
      const index = chooseStoryboardMergeIndex(rows);
      const left = rows[index];
      const right = rows[index + 1];
      const title = joinText(left.title, right.title, '与');
      db.prepare(`UPDATE storyboards SET
        title = ?, description = ?, dialogue = ?, narration = ?, action = ?, atmosphere = ?,
        image_prompt = ?, video_prompt = ?, characters = ?, duration = ?, updated_at = ?
        WHERE id = ?`).run(
        title,
        joinText(left.description, right.description),
        joinText(left.dialogue, right.dialogue),
        joinText(left.narration, right.narration),
        joinText(left.action, right.action),
        joinText(left.atmosphere, right.atmosphere, '、'),
        mergeImagePrompts(left.image_prompt, right.image_prompt),
        joinText(left.video_prompt, right.video_prompt, '；随后，'),
        mergeJsonArrays(left.characters, right.characters),
        Number(left.duration || 0) + Number(right.duration || 0),
        now,
        left.id
      );
      db.prepare('UPDATE storyboards SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, right.id);
      merged += 1;
      rows = db.prepare(`SELECT * FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL
        ORDER BY storyboard_number, id`).all(episodeId);
    }

    const baseDuration = Math.floor((duration / rows.length) * 10) / 10;
    let assigned = 0;
    rows.forEach((row, index) => {
      const shotDuration = index === rows.length - 1
        ? Number((duration - assigned).toFixed(1))
        : baseDuration;
      assigned += shotDuration;
      db.prepare('UPDATE storyboards SET storyboard_number = ?, duration = ?, updated_at = ? WHERE id = ?')
        .run(index + 1, shotDuration, now, row.id);
    });
    return { count: rows.length, merged, duration };
  });
  return tx();
}

async function generateScript(db, cfg, log, runId) {
  const run = getRunRow(db, runId);
  if (!run) return;
  const stepId = startStep(db, runId, 'real_script_generated', 'script', { provider: run.plan.providers?.text });
  try {
    assertRunnable(db, runId);
    const storyGenerationService = require('./storyGenerationService');
    const dramaService = require('./dramaService');
    const rejected = db.prepare("SELECT reviewer_comment FROM approval_requests WHERE run_id = ? AND approval_stage = 'script' AND status = 'REJECTED' ORDER BY resolved_at DESC LIMIT 1").get(runId);
    const premise = rejected?.reviewer_comment ? `${run.user_instruction}\n\n修改要求：${rejected.reviewer_comment}` : run.user_instruction;
    const reviewService = require('./agentReviewService');
    const priorCycle = reviewService.list(db, runId).find(x => x.stage === 'script');
    if (priorCycle) {
      const recovered = await reviewService.runScriptReview(db, log, run, priorCycle.versions.at(-1).episodes);
      assertRunnable(db, runId);
      completeStep(db, stepId, { review_id: recovered.id, preserved_existing_episodes: true });
      createApproval(db, runId, run.project_id, 'script', { review_id: recovered.id, review_status: recovered.status, review_reason: '自动修正额度不重置；请审核当前制作页剧本与历史版本', episodes: episodeSnapshot(db, run.project_id) });
      updateRun(db, runId, 'SCRIPT_REVIEW', 'script_review');
      return;
    }
    const result = await storyGenerationService.generateStory(db, log, {
      premise,
      style: run.plan.project.visual_style_prompt_zh || run.plan.project.visual_style,
      genre: run.plan.project.genre,
      episode_count: run.plan.project.episode_count,
      episode_duration_seconds: run.plan.project.episode_duration_seconds,
    });
    assertRunnable(db, runId);
    let episodes = (result.episodes || []).map((ep, index) => ({
      episode_number: ep.episode || index + 1,
      title: ep.title || `第${index + 1}集`,
      script_content: ep.content || '',
      description: String(ep.content || '').replace(/\s+/g, ' ').slice(0, 160),
      duration: run.plan.project.episode_duration_seconds,
    }));
    if (!episodes.length) throw new Error('AI 没有返回有效剧本');
    const review = await reviewService.runScriptReview(db, log, run, episodes);
    assertRunnable(db, runId);
    episodes = review.versions.at(-1).episodes;
    dramaService.saveEpisodes(db, log, run.project_id, { episodes });
    const oldEpisodes = run.plan.episodes || [];
    run.plan.episodes = episodes.map((ep, index) => ({
      episode_number: ep.episode_number,
      title: ep.title,
      synopsis: ep.description,
      shots: oldEpisodes[index]?.shots || Math.max(6, Math.round(run.plan.project.episode_duration_seconds / 6)),
    }));
    db.prepare('UPDATE agent_runs SET plan_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(run.plan), new Date().toISOString(), runId);
    completeStep(db, stepId, { episodes: episodes.map((ep) => ({ episode_number: ep.episode_number, title: ep.title })) });
    const approvalId = createApproval(db, runId, run.project_id, 'script', { review_id: review.id, review_status: review.status, review_reason: review.reason, episodes: episodes.map((ep) => ({ episode_number: ep.episode_number, title: ep.title, preview: ep.script_content.slice(0, 160) })) });
    updateRun(db, runId, 'SCRIPT_REVIEW', 'script_review');
    if (review.status === 'PASSED') {
      require('./agentWorkbenchService').approve(db, approvalId, 'approve', '独立剧本审核通过，自动进入下一阶段');
      runAction(db, cfg, log, runId, 'assets');
    }
  } catch (err) {
    if (err.code !== 'RUN_STOPPED') failRun(db, log, runId, 'script', stepId, err);
  }
}

async function generateAssets(db, cfg, log, runId) {
  const run = getRunRow(db, runId);
  if (!run) return;
  const stepId = startStep(db, runId, 'real_assets_generated', 'assets', { stages: ['characters', 'scenes', 'props', 'storyboards', 'reference_images'] });
  try {
    const characterGenerationService = require('./characterGenerationService');
    const backgroundExtractionService = require('./backgroundExtractionService');
    const propExtractionService = require('./propExtractionService');
    const episodeStoryboardService = require('./episodeStoryboardService');
    const characterLibraryService = require('./characterLibraryService');
    const sceneService = require('./sceneService');
    const episodes = episodeSnapshot(db, run.project_id);
    if (!episodes.length) throw new Error('没有可用于生产的剧本');

    assertRunnable(db, runId);
    const outline = `已确认创作约束：\n${run.plan.logline || ''}\n\n` + episodes.map((ep) => `第${ep.episode_number}集 ${ep.title}\n${ep.script_content}`).join('\n\n');
    const characterTask = characterGenerationService.generateCharacters(db, cfg, log, {
      drama_id: run.project_id, outline, approved_characters: run.plan.characters,
    });
    await waitTask(db, runId, characterTask, '角色提取', 12 * 60 * 1000);

    for (const episode of episodes) {
      assertRunnable(db, runId);
      const sceneTask = backgroundExtractionService.extractBackgroundsForEpisode(db, cfg, log, episode.id, undefined, undefined, 'zh');
      await waitTask(db, runId, sceneTask, `第${episode.episode_number}集场景提取`, 12 * 60 * 1000);
      const propTask = propExtractionService.extractPropsForEpisode(db, log, episode.id, cfg);
      await waitTask(db, runId, propTask, `第${episode.episode_number}集道具提取`, 12 * 60 * 1000);
      const epPlan = run.plan.episodes.find((item) => Number(item.episode_number) === Number(episode.episode_number));
      const storyboardTask = episodeStoryboardService.generateStoryboard(
        db, log, episode.id, undefined, undefined,
        epPlan?.shots || 6, run.plan.project.episode_duration_seconds,
        run.plan.project.aspect_ratio || '9:16', true, false
      );
      await waitTask(db, runId, storyboardTask.task_id, `第${episode.episode_number}集分镜`, 20 * 60 * 1000);
      normalizeEpisodeStoryboards(
        db,
        episode.id,
        epPlan?.shots || 6,
        run.plan.project.episode_duration_seconds
      );
    }

    const characters = db.prepare(`SELECT id, name FROM characters WHERE drama_id = ? AND deleted_at IS NULL ORDER BY sort_order, id LIMIT 4`).all(run.project_id);
    const scenes = db.prepare(`SELECT id, location FROM scenes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id LIMIT ?`).all(run.project_id, Math.max(3, episodes.length * 2));
    const imageCandidates = getActiveConfigs(db, 'image');
    const blockedCandidates = new Map();
    const assetJobs = [
      ...characters.map((item) => ({ type: 'character', item })),
      ...scenes.map((item) => ({ type: 'scene', item })),
    ];
    const assetResults = await runLimited(assetJobs, 2, async (job) => {
      assertRunnable(db, runId);
      let lastError = null;
      for (const candidate of imageCandidates) {
        if (blockedCandidates.has(candidate.id)) {
          lastError = blockedCandidates.get(candidate.id);
          continue;
        }
        try {
          const candidateModel = candidate.default_model || candidate.model?.[0];
          const submitted = job.type === 'character'
            ? await characterLibraryService.generateCharacterFourViewImage(db, log, cfg, job.item.id, candidateModel)
            : await sceneService.generateSceneSingleImage(db, log, cfg, job.item.id, candidateModel);
          if (!submitted?.ok || !submitted.image_generation?.task_id) throw new Error(submitted?.error || `${job.type}图片提交失败`);
          const value = await waitTask(db, runId, submitted.image_generation.task_id, `${job.type}参考图`, 15 * 60 * 1000);
          return { ...value, provider: candidate.provider, model: candidateModel };
        } catch (err) {
          lastError = err;
          if (isTerminalProviderError(err)) blockedCandidates.set(candidate.id, err);
          log.warn('Agent asset image provider failed, trying fallback', {
            run_id: runId,
            asset_type: job.type,
            asset_id: job.item.id,
            provider: candidate.provider,
            model: candidate.default_model || candidate.model?.[0],
            error: err.message,
          });
        }
      }
      const model = imageCandidates.at(-1)?.default_model || imageCandidates.at(-1)?.model?.[0];
      throw new Error(friendlyProviderError(lastError || new Error('没有可用的图片配置'), model));
    });
    const assetFailures = assetResults.filter((item) => !item.ok).map((item) => item.error.message);
    const storyboardCount = db.prepare(`SELECT COUNT(*) AS n FROM storyboards s JOIN episodes e ON e.id = s.episode_id
      WHERE e.drama_id = ? AND s.deleted_at IS NULL AND e.deleted_at IS NULL`).get(run.project_id).n;
    const output = { characters: characters.length, scenes: scenes.length, storyboards: storyboardCount, reference_images_completed: assetResults.length - assetFailures.length, warnings: assetFailures };
    completeStep(db, stepId, output);
    createApproval(db, runId, run.project_id, 'assets', output);
    updateRun(db, runId, 'ASSET_REVIEW', 'asset_review');
  } catch (err) {
    if (err.code !== 'RUN_STOPPED') failRun(db, log, runId, 'assets', stepId, err);
  }
}

const VIDEO_MODEL_IDS = {
  mini: 'doubao-seedance-2-0-mini-260615',
  fast: 'doubao-seedance-2-0-fast-260128',
  dialogue: 'doubao-seedance-1-5-pro-251215',
  standard: 'doubao-seedance-2-0-260128',
  flagship: 'doubao-seedance-2-5-260628',
};

function storyboardCharacterCount(storyboard) {
  const characters = parseJson(storyboard?.characters, []);
  return Array.isArray(characters) ? characters.length : 0;
}

function selectVideoModel(storyboard, providerConfig) {
  const models = Array.isArray(providerConfig?.model) ? providerConfig.model.filter(Boolean) : [];
  const fallback = providerConfig?.default_model || models[0] || null;
  if (!models.length) return fallback;
  const available = new Set(models);
  const pick = (...preferences) => preferences.find((model) => available.has(model)) || fallback;
  const dialogue = String(storyboard?.dialogue || '').trim();
  const action = String(storyboard?.action || storyboard?.video_prompt || storyboard?.description || '');
  const characterCount = storyboardCharacterCount(storyboard);
  const intensity = Number(storyboard?.emotion_intensity) || 0;
  const complexAction = /打斗|追逐|争抢|爆炸|坠落|变身|觉醒|瞬移|飞行|群像|高速|猛然|翻滚|碰撞|多段|切镜|环绕|子弹时间|battle|fight|chase|transform/i.test(action);

  if (intensity >= 2 || (characterCount >= 2 && (dialogue || complexAction))) {
    return pick(VIDEO_MODEL_IDS.flagship, VIDEO_MODEL_IDS.standard, VIDEO_MODEL_IDS.dialogue, VIDEO_MODEL_IDS.fast, VIDEO_MODEL_IDS.mini);
  }
  if (dialogue) {
    return pick(VIDEO_MODEL_IDS.dialogue, VIDEO_MODEL_IDS.flagship, VIDEO_MODEL_IDS.standard, VIDEO_MODEL_IDS.fast, VIDEO_MODEL_IDS.mini);
  }
  if (characterCount >= 2) {
    return pick(VIDEO_MODEL_IDS.standard, VIDEO_MODEL_IDS.flagship, VIDEO_MODEL_IDS.fast, VIDEO_MODEL_IDS.mini, VIDEO_MODEL_IDS.dialogue);
  }
  if (characterCount === 0) {
    return pick(VIDEO_MODEL_IDS.mini, VIDEO_MODEL_IDS.fast, VIDEO_MODEL_IDS.standard, VIDEO_MODEL_IDS.flagship, VIDEO_MODEL_IDS.dialogue);
  }
  return pick(VIDEO_MODEL_IDS.fast, VIDEO_MODEL_IDS.standard, VIDEO_MODEL_IDS.flagship, VIDEO_MODEL_IDS.mini, VIDEO_MODEL_IDS.dialogue);
}

function createVideoGeneration(db, log, run, storyboard, providerConfig, options = {}) {
  const taskService = require('./taskService');
  const videoService = require('./videoService');
  const task = taskService.createTask(db, log, 'video_generation', String(run.project_id));
  const now = new Date().toISOString();
  const imageUrl = storyboard.local_path || storyboard.image_url || null;
  const selectedModel = selectVideoModel(storyboard, providerConfig);
  const info = db.prepare(`INSERT INTO video_generations
    (drama_id, storyboard_id, provider, prompt, model, duration, aspect_ratio, resolution, watermark, image_url, first_frame_url, status, task_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'processing', ?, ?, ?)`)
    .run(run.project_id, options.detached ? null : storyboard.id, providerConfig?.provider || 'auto', options.prompt || storyboard.video_prompt || storyboard.image_prompt || storyboard.description || '',
      selectedModel, Number(storyboard.duration) || 5,
      run.plan.project.aspect_ratio || '9:16', run.plan.project.resolution || '720p', imageUrl, imageUrl, task.id, now, now);
  const id = Number(info.lastInsertRowid);
  setImmediate(() => videoService.processVideoGeneration(db, log, id));
  return { id, task_id: task.id, model: selectedModel };
}

function recordUsage(db, run, shot, config, operation, estimate, taskId) {
  const id = uuidv4();
  db.prepare(`INSERT INTO generation_usage
    (id, run_id, project_id, episode_id, shot_id, provider, model, operation, quantity, estimated_cost, actual_cost, external_task_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`)
    .run(id, run.id, run.project_id, shot.episode_id, shot.id, config?.provider || 'auto', config?.default_model || config?.model?.[0] || 'default', operation, estimate, taskId ? 0 : estimate, taskId || null, new Date().toISOString());
  return id;
}

function settleUsage(db, usageId, succeeded) {
  db.prepare('UPDATE generation_usage SET actual_cost = CASE WHEN ? THEN estimated_cost ELSE 0 END WHERE id = ?')
    .run(succeeded ? 1 : 0, usageId);
}

function storageRootFromConfig(cfg) {
  const configured = cfg.storage?.local_path || './data/storage';
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function createLocalMotionFallback(db, cfg, log, run, shot) {
  if (!hasLocalFfmpeg() || !shot.local_path) return null;
  const storageRoot = storageRootFromConfig(cfg);
  const imagePath = path.join(storageRoot, String(shot.local_path).replace(/\//g, path.sep));
  if (!fs.existsSync(imagePath)) return null;
  const projectSubdir = storageLayout.getProjectStorageSubdir(db, run.project_id);
  const relativePath = path.join(projectSubdir, 'videos', 'fallback', `sb${shot.id}_kenburns.mp4`).replace(/\\/g, '/');
  const outputPath = path.join(storageRoot, relativePath.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const duration = Math.max(1, Number(shot.duration) || 5);
  const frames = Math.max(1, Math.round(duration * 25));
  const filter = `zoompan=z='min(zoom+0.0006,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=720x1280:fps=25,format=yuv420p`;
  const result = spawnSync(getFfmpegPath(), [
    '-y', '-loop', '1', '-i', imagePath, '-vf', filter,
    '-t', String(duration), '-r', '25', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an', outputPath,
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0 || !fs.existsSync(outputPath)) {
    log.warn('Agent local motion fallback failed', { storyboard_id: shot.id, error: result.stderr?.slice(-500) });
    return null;
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE storyboards SET video_url = ? WHERE id = ?').run(relativePath, shot.id);
  db.prepare(`INSERT INTO video_generations
    (drama_id, storyboard_id, provider, prompt, model, duration, aspect_ratio, resolution, watermark,
     video_url, local_path, status, completed_at, created_at, updated_at)
    VALUES (?, ?, 'local_ffmpeg', ?, 'ken_burns_fallback', ?, ?, '720p', 0, ?, ?, 'completed', ?, ?, ?)`).run(
    run.project_id, shot.id, 'AI 视频不可用时的静态关键帧运镜兜底', duration,
    run.plan.project.aspect_ratio || '9:16', relativePath, relativePath, now, now, now
  );
  return { storyboard_id: shot.id, local_path: relativePath };
}

async function generateMedia(db, cfg, log, runId, phase = 'images') {
  const run = getRunRow(db, runId);
  if (!run) return;
  const stepId = startStep(db, runId, phase === 'images' ? 'real_images_generated' : 'real_media_generated', phase, { image_concurrency: 2, video_concurrency: 1 });
  try {
    const imageService = require('./imageService');
    const ttsService = require('./ttsService');
    const providerStatus = getProviderStatus(db);
    const imageCandidates = getActiveConfigsWithFallback(db, 'storyboard_image', 'image');
    const videoConfig = getDefaultConfig(db, 'video').config;
    const ttsConfig = getDefaultConfig(db, 'tts').config;
    const storyboards = db.prepare(`SELECT s.*, e.drama_id FROM storyboards s JOIN episodes e ON e.id = s.episode_id
      WHERE e.drama_id = ? AND s.deleted_at IS NULL AND e.deleted_at IS NULL ORDER BY e.episode_number, s.storyboard_number`).all(run.project_id);
    if (!storyboards.length) throw new Error('没有可用于媒体生产的分镜');

    const imageGate = require('./agentImageGate');
    if (phase === 'videos') imageGate.assertApproved(db, run, cfg);
    const blockedImageCandidates = new Map();
    const imageResults = phase === 'videos' ? [] : await runLimited(storyboards, 2, async (shot) => {
      assertRunnable(db, runId);
      const priorReview = db.prepare("SELECT id FROM agent_review_cycles WHERE run_id=? AND stage=?").get(run.id, `image:${shot.id}`);
      if (priorReview) return { reused: true, review_id: priorReview.id }; // Recovery must not buy a new image before returning the existing review.
      const reusable = db.prepare("SELECT id FROM image_generations WHERE storyboard_id=? AND status='completed' AND deleted_at IS NULL AND prompt=? ORDER BY id DESC LIMIT 1").get(shot.id, shot.image_prompt || shot.description || shot.title);
      if (reusable && (shot.local_path || shot.image_url)) return { reused: true, image_id: reusable.id };
      let lastError = null;
      for (const imageConfig of imageCandidates) {
        if (blockedImageCandidates.has(imageConfig.id)) {
          lastError = blockedImageCandidates.get(imageConfig.id);
          continue;
        }
        try {
          const created = imageService.create(db, log, {
            drama_id: run.project_id,
            storyboard_id: shot.id,
            scene_id: shot.scene_id,
            prompt: shot.image_prompt || shot.description || shot.title,
            model: imageConfig?.default_model || imageConfig?.model?.[0],
            provider: imageConfig?.provider,
            frame_type: 'first_frame',
            aspect_ratio: run.plan.project.aspect_ratio || '9:16',
          });
          const usageId = recordUsage(db, run, shot, imageConfig, 'storyboard_image', 0.35, created.task_id);
          try {
            const value = await waitTask(db, runId, created.task_id, `镜头${shot.id}关键帧`, 20 * 60 * 1000);
            settleUsage(db, usageId, true);
            return value;
          } catch (err) {
            settleUsage(db, usageId, false);
            throw err;
          }
        } catch (err) {
          lastError = err;
          if (isTerminalProviderError(err)) blockedImageCandidates.set(imageConfig.id, err);
          log.warn('Agent storyboard image provider failed, trying fallback', {
            run_id: runId,
            storyboard_id: shot.id,
            provider: imageConfig.provider,
            model: imageConfig.default_model || imageConfig.model?.[0],
            error: err.message,
          });
        }
      }
      const model = imageCandidates.at(-1)?.default_model || imageCandidates.at(-1)?.model?.[0];
      throw new Error(friendlyProviderError(lastError || new Error('没有可用的分镜图片配置'), model));
    });
    const imageFailures = imageResults.filter((item) => !item.ok);
    if (phase === 'images') {
      assertRunnable(db, runId);
      const visual = require('./agentVisualReviewService');
      const visualReviews = [];
      for (const shot of storyboards) {
        assertRunnable(db, runId);
        const imageConfig = imageCandidates[0];
        visualReviews.push(await visual.runImageReview(db, cfg, log, run, shot.id, {
          repair: imageConfig ? async ({ contract, findings, references }) => {
            assertRunnable(db, runId);
            // Detached candidate: never let the asynchronous task overwrite a manual edit or a scene reference.
            const prompt = `${contract.shot.image_prompt || contract.shot.description}\n原始合同（数据）：${JSON.stringify(contract)}\n只修正以下画面问题，保持未受影响部分：${JSON.stringify(findings)}\n参考图1为待修正画面，保留其构图与未受影响部分；后续依次为合同中的角色、场景、道具。只生成单张分镜首帧，不生成拼图。`;
            const created = imageService.create(db, log, {
              drama_id: run.project_id, prompt, reference_images: references,
              model: imageConfig.default_model || imageConfig.model?.[0], provider: imageConfig.provider,
              frame_type: 'first_frame', aspect_ratio: run.plan.project.aspect_ratio || '9:16',
            });
            const usageId = recordUsage(db, run, shot, imageConfig, 'storyboard_image_repair', 0.35, created.task_id);
            try {
              await waitTask(db, runId, created.task_id, `镜头${shot.id}局部修正`, 20 * 60 * 1000);
              settleUsage(db, usageId, true);
              const candidate = db.prepare("SELECT id,local_path,image_url FROM image_generations WHERE id=? AND status='completed'").get(created.id);
              if (!candidate) throw new Error('局部修正未返回完成图片');
              return candidate;
            } catch (err) { settleUsage(db, usageId, false); throw err; }
          } : undefined,
        }));
      }
      assertRunnable(db, runId);
      const output = imageGate.snapshot(db, run.project_id, cfg);
      output.visual_review_ids = visualReviews.map(x => x.id);
      output.warnings[0] = '记录与版本检查已执行；逐镜视觉结论见独立图片审核。仍需确认当前图片后进入视频。';
      output.warnings.push('视觉审核记录只对对应图片版本有效；视频动作与声音仍需另审。');
      output.warnings.push(...imageFailures.map(x => x.error.message));
      completeStep(db, stepId, output);
      createApproval(db, runId, run.project_id, 'images', output);
      updateRun(db, runId, 'IMAGE_REVIEW', 'images_review');
      return;
    }

    const refreshed = db.prepare(`SELECT s.* FROM storyboards s JOIN episodes e ON e.id = s.episode_id
      WHERE e.drama_id = ? AND s.deleted_at IS NULL AND e.deleted_at IS NULL ORDER BY e.episode_number, s.storyboard_number`).all(run.project_id);
    const voiceContract = require('./productionVoiceContract');
    const cast = db.prepare('SELECT * FROM characters WHERE drama_id = ? AND deleted_at IS NULL').all(run.project_id);
    const plannedAudio = new Map();
    for (const shot of refreshed) {
      voiceContract.assertShot(shot);
      if (ttsConfig) plannedAudio.set(shot.id, voiceContract.audioJobs(shot, cast, ttsConfig));
    }
    const videoShots = refreshed.filter((item) => item.image_url || item.local_path);
    const videoResults = await runLimited(videoShots, 1, async (shot) => {
      assertRunnable(db, runId);
      imageGate.assertApproved(db, run, cfg);
      const created = createVideoGeneration(db, log, run, shot, videoConfig);
      const selectedConfig = { ...videoConfig, default_model: created.model };
      const usageId = recordUsage(db, run, shot, selectedConfig, 'video', 5.5, created.task_id);
      try {
        const value = await waitTask(db, runId, created.task_id, `镜头${shot.id}视频`, 45 * 60 * 1000);
        settleUsage(db, usageId, true);
        return value;
      } catch (err) {
        settleUsage(db, usageId, false);
        throw err;
      }
    });

    imageGate.assertApproved(db, run, cfg);
    const fallbackVideos = [];
    for (const shot of refreshed) {
      const completed = db.prepare(`SELECT id FROM video_generations
        WHERE storyboard_id = ? AND status = 'completed' AND deleted_at IS NULL
        ORDER BY created_at DESC LIMIT 1`).get(shot.id);
      if (completed) continue;
      const fallback = createLocalMotionFallback(db, cfg, log, run, shot);
      if (fallback) fallbackVideos.push(fallback);
    }

    let voiceCompleted = 0;
    const voiceFailures = [];
    if (ttsConfig) {
      const storageBase = path.isAbsolute(cfg.storage?.local_path || '') ? cfg.storage.local_path : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
      for (const shot of refreshed) {
        for (const audioJob of plannedAudio.get(shot.id) || []) {
        const { text, voice_id, column } = audioJob;
        try {
          assertRunnable(db, runId);
          const audio = await ttsService.synthesize(db, log, { text, storyboard_id: shot.id, config: ttsConfig, storage_base: storageBase, voice_id });
          db.prepare(`UPDATE storyboards SET ${column} = ?, updated_at = ? WHERE id = ?`).run(audio.local_path, new Date().toISOString(), shot.id);
          recordUsage(db, run, shot, ttsConfig, 'tts', 0.08, null);
          voiceCompleted += 1;
        } catch (err) { voiceFailures.push(`镜头${shot.id}: ${err.message}`); }
        }
      }
    }

    const actualCost = db.prepare('SELECT COALESCE(SUM(actual_cost), 0) AS n FROM generation_usage WHERE run_id = ?').get(runId).n;
    db.prepare('UPDATE agent_runs SET actual_cost = ?, updated_at = ? WHERE id = ?').run(Number(actualCost.toFixed(2)), new Date().toISOString(), runId);
    const output = await reviewMedia(db, cfg, log, runId, {
      videos_failed: videoResults.filter(x => !x.ok).length, voice_completed: voiceCompleted,
      warnings: videoResults.filter(x=>!x.ok).map(x=>x.error.message).concat(voiceFailures, providerStatus.warnings),
    });
    if (output) completeStep(db, stepId, output);

  } catch (err) {
    if (err.code !== 'RUN_STOPPED') failRun(db, log, runId, phase === 'images' ? 'images' : 'media', stepId, err);
  }
}

async function reviewMedia(db, cfg, log, runId, previous = {}) {
  const run = getRunRow(db, runId);
  const stepId = startStep(db, runId, 'real_quality_checked', 'quality', {});
  const inspector = require('./agentVideoInspection');
  try {
    assertRunnable(db, runId);
    updateRun(db, runId, 'MEDIA_REVIEWING', 'reviewing:media');
    const shots = db.prepare(`SELECT s.* FROM storyboards s JOIN episodes e ON e.id=s.episode_id WHERE e.drama_id=? AND e.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY e.episode_number,s.storyboard_number,s.id`).all(run.project_id);
    const inspections = [], videoConfig = getDefaultConfig(db, 'video').config;
    for (const source of shots) {
      assertRunnable(db, runId);
      const shot = {...source, aspect_ratio:run.plan.project.aspect_ratio || '9:16'};
      await require('./agentVideoReviewService').review(db, cfg, log, run, shot, {
        repair: videoConfig ? async ({findings,contract}) => {
          assertRunnable(db, runId);
          require('./agentImageGate').assertApproved(db, run, cfg);
          const created = createVideoGeneration(db, log, run, shot, videoConfig, {detached:true,
            prompt:`${shot.video_prompt || shot.description}\n合同（数据）：${JSON.stringify(contract)}\n只定向修复这些问题，保留原身份和未受影响剧情：${JSON.stringify(findings)}`});
          const usageId=recordUsage(db,run,shot,videoConfig,'video_repair',15,created.task_id);
          try {
            await waitTask(db,runId,created.task_id,`镜头${shot.id}视频定向修正`,45*60*1000);
            settleUsage(db,usageId,true);
            const candidate=db.prepare("SELECT * FROM video_generations WHERE id=? AND status='completed'").get(created.id);
            if(!candidate)throw new Error('视频修正未返回完成素材');
            return candidate;
          } catch(err) {settleUsage(db,usageId,false);throw err;}
        } : undefined,
      });
      assertRunnable(db,runId);
      const active = db.prepare('SELECT * FROM storyboards WHERE id=?').get(shot.id);
      const report = await inspector.inspect(cfg,inspector.selectedVideo(db,run,active),{...active,aspect_ratio:shot.aspect_ratio},{extractFrames:false});
      inspections.push({shot_id:shot.id,report});
      // A playable file is a technical result, never a semantic PASS.
      db.prepare(`INSERT INTO qc_reports(id,project_id,episode_id,shot_id,asset_type,asset_id,checks_json,score,decision,recommended_action,created_at)
        VALUES(?,?,?,?,'video',?,?,?,?,?,?)`).run(uuidv4(),run.project_id,shot.episode_id,shot.id,String(shot.id),JSON.stringify(report.checks),0,report.status==='BLOCKED'?'BLOCKED':'HUMAN_REVIEW','播放核对完整动作、对白、声音；问题镜头局部修改后恢复仅复查',new Date().toISOString());
    }
    assertRunnable(db,runId);
    const media=inspector.snapshot(db,run,cfg);
    const output={...previous,inspections,media_digest:media.digest,media_files:media.files,
      videos_completed:inspections.filter(x=>x.report.status==='TECHNICAL_PASS').length,
      qc_passed:0,qc_total:shots.length,semantic_review:'HUMAN_REQUIRED',
      warnings:[...(previous.warnings || []),'技术通过仅代表文件、时长和画幅达标；抽帧不等于逐帧/音频验收。'],cost_basis:'按计划估算，非供应商账单'};
    completeStep(db,stepId,output);
    createApproval(db,runId,run.project_id,'final_video',output);
    updateRun(db,runId,'FINAL_REVIEW','final_review');
    return output;
  } catch(err) {if(err.code!=='RUN_STOPPED')failRun(db,log,runId,'media_review',stepId,err);return null;}
}

async function exportProject(db, cfg, log, runId) {
  const run = getRunRow(db, runId);
  if (!run) return;
  const stepId = startStep(db, runId, 'real_export_ready', 'export', {});
  try {
    const inspector = require('./agentVideoInspection');
    inspector.assertApproved(db, run, cfg);
    const pinned = inspector.snapshot(db, run, cfg);
    const dramaService = require('./dramaService');
    const episodes = episodeSnapshot(db, run.project_id);
    const baseUrl = cfg.server?.public_base_url || `http://127.0.0.1:${cfg.server?.port || 5679}/static`;
    const merges = [];
    for (const episode of episodes) {
      assertRunnable(db, runId);
      inspector.assertApproved(db, run, cfg);
      const approvedPaths = Object.fromEntries(pinned.shots.filter(s=>s.episode_id===episode.id).map(s=>[s.id,baseUrl.replace(/\/$/,'')+'/'+s.selected_local_path.replace(/^\/static\//,'')]));
      const created = dramaService.finalizeEpisode(db, log, episode.id, baseUrl, { burn_narration_subtitles: true, burn_dialogue_audio: true, approved_video_paths: approvedPaths });
      if (created?.task_id) {
        await waitTask(db, runId, created.task_id, `第${episode.episode_number}集成片合成`, 20 * 60 * 1000);
        const merged = db.prepare('SELECT merged_url FROM video_merges WHERE id=?').get(created.merge_id);
        const expected = pinned.shots.filter(s=>s.episode_id===episode.id).reduce((n,s)=>n+Number(s.duration),0);
        const report = await inspector.inspect(cfg,{local_path:merged?.merged_url},{duration:expected,aspect_ratio:run.plan.project.aspect_ratio},{extractFrames:false});
        if(report.status!=='TECHNICAL_PASS')throw new Error('合成产物未通过实际文件验收：'+JSON.stringify(report.checks));
        merges.push({ episode_id: episode.id, merge_id: created.merge_id, path:merged.merged_url, inspection:report });
      }
    }
    inspector.assertApproved(db, run, cfg);
    if (!merges.length) throw new Error('没有可合成的视频镜头；请在制作页重试失败的视频');
    completeStep(db, stepId, { project_id: run.project_id, episodes: merges });
    db.prepare("UPDATE dramas SET status = 'completed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), run.project_id);
    updateRun(db, runId, 'EXPORTED', 'complete');
  } catch (err) {
    if (err.code !== 'RUN_STOPPED') failRun(db, log, runId, 'export', stepId, err);
  }
}

function runAction(db, cfg, log, runId, action) {
  const key = `${runId}:${action}`;
  if (activeJobs.has(key)) return false;
  activeJobs.add(key);
  setImmediate(async () => {
    try {
      if (action === 'script') await generateScript(db, cfg, log, runId);
      else if (action === 'assets') await generateAssets(db, cfg, log, runId);
      else if (action === 'images') await generateMedia(db, cfg, log, runId, 'images');
      else if (action === 'media') await generateMedia(db, cfg, log, runId, 'videos');
      else if (action === 'media_review') await reviewMedia(db, cfg, log, runId);
      else if (action === 'export') await exportProject(db, cfg, log, runId);
    } finally {
      activeJobs.delete(key);
    }
  });
  return true;
}

function recoverInterruptedRuns(db, log) {
  const rows = db.prepare(`SELECT id, current_step, status FROM agent_runs WHERE dry_run = 0 AND status IN ('SCRIPT_GENERATING','ASSET_GENERATING','IMAGE_GENERATING','MEDIA_GENERATING','MEDIA_REVIEWING','EXPORTING')`).all();
  if (!rows.length) return 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    const action = ({ SCRIPT_GENERATING: 'script', ASSET_GENERATING: 'assets', IMAGE_GENERATING: 'images', MEDIA_GENERATING: 'media_review', MEDIA_REVIEWING: 'media_review', EXPORTING: 'export' })[row.status] || 'script';
    db.prepare("UPDATE agent_runs SET status = 'FAILED', current_step = ?, updated_at = ? WHERE id = ?")
      .run(`failed:${action}`, now, row.id);
  }
  log.warn('Interrupted Agent runs marked retryable', { count: rows.length });
  return rows.length;
}

module.exports = {
  GENERATING_STATUSES,
  getProviderStatus,
  normalizeEpisodeStoryboards,
  selectVideoModel,
  runAction,
  recoverInterruptedRuns,
};
