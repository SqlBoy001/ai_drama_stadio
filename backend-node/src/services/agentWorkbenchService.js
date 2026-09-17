const { v4: uuidv4 } = require('uuid');
const { resolveStylePreset } = require('../constants/generationStylePresets');

const SUSPENSE_REALISTIC_STYLE = 'urban suspense cinematic';

const TERMINAL = new Set(['EXPORTED', 'CANCELLED']);
const REVIEW_STATUS = {
  script: 'SCRIPT_REVIEW',
  assets: 'ASSET_REVIEW',
  final_video: 'FINAL_REVIEW',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}

function matchNumber(text, pattern) {
  const match = String(text || '').match(pattern);
  return match ? Number(match[1]) : undefined;
}

function inferTitle(instruction) {
  const quoted = String(instruction || '').match(/[《“\"]([^》”\"]+)[》”\"]/);
  if (quoted) return quoted[1].trim().slice(0, 60);
  const first = String(instruction || '').split(/[，。,.!！?？\n]/)[0].trim();
  return (first || '未命名 AI 短剧').slice(0, 30);
}

function createPlan(input = {}) {
  const instruction = String(input.instruction || input.idea || '').trim();
  if (!instruction) throw new Error('请输入一句短剧创意');
  const genre = input.genre || '都市轻喜剧';
  const visualStyleAuto = input.visual_style_auto !== false;
  const requestedStyle = String(input.visual_style || '2.5D国漫').trim() || '2.5D国漫';
  const suspenseStory = /悬疑|惊悚|恐怖|怪谈/.test(`${genre} ${instruction}`);
  const visualStyle = visualStyleAuto && suspenseStory ? SUSPENSE_REALISTIC_STYLE : requestedStyle;
  const visualPreset = resolveStylePreset(visualStyle);
  const episodeCount = clamp(input.episode_count || matchNumber(instruction, /(\d+)\s*集/) || 3, 1, 10);
  const duration = clamp(input.episode_duration_seconds || matchNumber(instruction, /(\d+)\s*秒/) || 45, 30, 90);
  const budget = clamp(input.budget_limit || matchNumber(instruction, /预算[^\d]*(\d+(?:\.\d+)?)/) || 300, 10, 100000);
  const saveCost = input.save_cost !== false;
  const shotsPerEpisode = clamp(Math.round(duration / 6), 6, 12);
  const shots = shotsPerEpisode * episodeCount;
  const videos = shots;
  const images = shots + 4;
  const voiceSegments = shots;
  const estimatedCost = Number((images * 0.35 + videos * 5.5 + voiceSegments * 0.08).toFixed(2));
  const dryRun = input.dry_run !== false && input.execution_mode !== 'real';
  const plan = {
    project: {
      title: String(input.title || inferTitle(instruction)).trim().slice(0, 60),
      genre,
      visual_style: visualStyle,
      visual_style_auto: visualStyleAuto,
      visual_style_prompt_zh: visualPreset?.zh || visualStyle,
      visual_style_prompt_en: visualPreset?.en || visualStyle,
      aspect_ratio: '9:16',
      episode_count: episodeCount,
      episode_duration_seconds: duration,
    },
    logline: instruction,
    characters: [
      { temporary_id: 'C01', name: '主角', role: 'protagonist', visual_anchor: '高辨识度发型、统一主色服装、稳定五官' },
      { temporary_id: 'C02', name: '关键配角', role: 'supporting', visual_anchor: '与主角形成轮廓和色彩反差' },
      { temporary_id: 'C03', name: '系统声音', role: 'minor', visual_anchor: '无实体，以界面光效和声音出现' },
    ],
    episodes: Array.from({ length: episodeCount }, (_, index) => ({
      episode_number: index + 1,
      title: `第${index + 1}集 · ${index === 0 ? '意外开局' : index === episodeCount - 1 ? '反转收束' : '冲突升级'}`,
      synopsis: index === 0 ? '主角遭遇突发事件并获得改变局面的机会。' : index === episodeCount - 1 ? '伏笔回收，主角完成关键选择并留下新钩子。' : '目标受阻，人物关系与代价同步升级。',
      shots: shotsPerEpisode,
    })),
    estimated: {
      episodes: episodeCount,
      shots,
      images,
      videos,
      voice_segments: voiceSegments,
      estimated_cost: estimatedCost,
      currency: 'CNY',
      budget_limit: budget,
    },
    providers: dryRun
      ? { text: 'mock-local', image: 'mock-local', video: 'mock-local', voice: 'mock-local' }
      : { text: '自动选择默认配置', image: '自动选择默认配置', video: '自动选择默认配置', voice: '可选，未配置时使用字幕' },
    approval_gates: ['script', 'assets', 'final_video'],
    dry_run: dryRun,
    cost_strategy: saveCost
      ? '全部镜头动态化；通过智能模型路由与资产复用节省费用，不牺牲叙事完整性'
      : '全部镜头动态化；复杂镜头优先使用高质量模型',
  };
  plan.budget_warning = estimatedCost > budget;
  return plan;
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function rowToRun(row) {
  if (!row) return null;
  return {
    ...row,
    dry_run: Boolean(row.dry_run),
    parsed_intent: parseJson(row.parsed_intent_json, {}),
    plan: parseJson(row.plan_json, {}),
  };
}

function getRun(db, runId) {
  const run = rowToRun(db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(runId));
  if (!run) return null;
  run.steps = db.prepare('SELECT * FROM agent_steps WHERE run_id = ? ORDER BY started_at, rowid').all(runId).map((row) => ({
    ...row,
    input: parseJson(row.input_json, null),
    output: parseJson(row.output_json, null),
  }));
  run.approvals = db.prepare('SELECT * FROM approval_requests WHERE run_id = ? ORDER BY created_at DESC').all(runId).map((row) => ({ ...row, snapshot: parseJson(row.snapshot_json, {}) }));
  run.usage = db.prepare('SELECT * FROM generation_usage WHERE run_id = ? ORDER BY created_at DESC').all(runId);
  run.qc_reports = run.project_id ? db.prepare('SELECT * FROM qc_reports WHERE project_id = ? ORDER BY created_at DESC').all(run.project_id).map((row) => ({ ...row, checks: parseJson(row.checks_json, []) })) : [];
  return run;
}

function listRuns(db) {
  return db.prepare('SELECT * FROM agent_runs ORDER BY updated_at DESC').all().map(rowToRun);
}

function insertStep(db, runId, key, type, status, output) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM agent_steps WHERE idempotency_key = ?').get(`${runId}:${key}`);
  if (existing) return existing;
  const id = uuidv4();
  db.prepare(`INSERT INTO agent_steps
    (id, run_id, step_key, step_type, output_json, status, idempotency_key, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, runId, key, type, output ? JSON.stringify(output) : null, status, `${runId}:${key}`, now, status === 'COMPLETED' ? now : null);
  return db.prepare('SELECT * FROM agent_steps WHERE id = ?').get(id);
}

function createApproval(db, runId, projectId, stage, snapshot) {
  const existing = db.prepare("SELECT * FROM approval_requests WHERE run_id = ? AND approval_stage = ? AND status = 'PENDING'").get(runId, stage);
  if (existing) return existing;
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO approval_requests
    (id, run_id, project_id, target_type, target_id, approval_stage, snapshot_json, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`)
    .run(id, runId, projectId, stage === 'final_video' ? 'video' : stage, String(projectId), stage, JSON.stringify(snapshot || {}), now);
  return db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id);
}

function seedProject(db, log, plan, options = {}) {
  const dryRun = options.dryRun !== false;
  const seedEpisodes = options.seedEpisodes !== false;
  const dramaService = require('./dramaService');
  const drama = dramaService.createDrama(db, log, {
    title: plan.project.title,
    description: plan.logline,
    genre: plan.project.genre,
    style: plan.project.visual_style,
    metadata: {
      aspect_ratio: '9:16',
      video_clip_duration: 5,
      agent_created: true,
      dry_run: dryRun,
      style_prompt_zh: plan.project.visual_style_prompt_zh || plan.project.visual_style,
      style_prompt_en: plan.project.visual_style_prompt_en || plan.project.visual_style,
    },
  });
  if (!seedEpisodes) return drama;
  const now = new Date().toISOString();
  for (const ep of plan.episodes) {
    const script = `【开场】${plan.logline}\n【冲突】${ep.synopsis}\n【结尾钩子】主角的选择带来新的悬念。`;
    db.prepare(`INSERT INTO episodes
      (drama_id, episode_number, title, script_content, description, duration, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`)
      .run(drama.id, ep.episode_number, ep.title, script, ep.synopsis, plan.project.episode_duration_seconds, now, now);
  }
  return drama;
}

function createRun(db, log, payload = {}) {
  const plan = payload.plan || createPlan(payload);
  if (!plan?.project || !plan?.estimated) throw new Error('生产计划不完整');
  if (plan.estimated.estimated_cost > Number(payload.budget_limit || plan.estimated.budget_limit || 0)) {
    const err = new Error('预计费用超过预算，请修改计划或提高预算');
    err.code = 'BUDGET_BLOCKED';
    throw err;
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  const dryRun = payload.dry_run !== false && plan.dry_run !== false;
  const create = db.transaction(() => {
    const project = seedProject(db, log, plan, { dryRun, seedEpisodes: dryRun });
    db.prepare(`INSERT INTO agent_runs
      (id, project_id, user_instruction, parsed_intent_json, plan_json, status, current_step, dry_run, budget_limit, estimated_cost, actual_cost, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`)
      .run(id, project.id, plan.logline, JSON.stringify(plan.project), JSON.stringify(plan),
        dryRun ? 'SCRIPT_REVIEW' : 'SCRIPT_GENERATING', dryRun ? 'script_review' : 'generating:script', dryRun ? 1 : 0,
        Number(payload.budget_limit || plan.estimated.budget_limit), plan.estimated.estimated_cost, now, now);
    insertStep(db, id, 'plan_confirmed', 'planning', 'COMPLETED', plan);
    if (dryRun) {
      insertStep(db, id, 'script_generated', 'script', 'COMPLETED', { episodes: plan.episodes });
      createApproval(db, id, project.id, 'script', { title: project.title, episodes: plan.episodes });
    }
  });
  create();
  return getRun(db, id);
}

function generateAssets(db, run) {
  const now = new Date().toISOString();
  const plan = run.plan;
  const characterIds = [];
  for (const [index, character] of plan.characters.entries()) {
    const info = db.prepare(`INSERT INTO characters
      (drama_id, name, role, description, appearance, identity_anchors, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(run.project_id, character.name, character.role, character.visual_anchor, character.visual_anchor, JSON.stringify({ visual_anchor: character.visual_anchor }), index, now, now);
    characterIds.push(Number(info.lastInsertRowid));
  }
  const episodes = db.prepare('SELECT * FROM episodes WHERE drama_id = ? ORDER BY episode_number').all(run.project_id);
  for (const episode of episodes) {
    const scene = db.prepare(`INSERT INTO scenes
      (drama_id, episode_id, location, time, prompt, polished_prompt, status, created_at, updated_at)
      VALUES (?, ?, ?, '日间', ?, ?, 'ready', ?, ?)`)
      .run(run.project_id, episode.id, `第${episode.episode_number}集主场景`, `${plan.project.visual_style}，竖屏构图，连续光线`, `${plan.project.visual_style}，竖屏构图，连续光线`, now, now);
    for (const characterId of characterIds) {
      db.prepare('INSERT OR IGNORE INTO episode_characters (episode_id, character_id) VALUES (?, ?)').run(episode.id, characterId);
    }
    const episodePlan = plan.episodes[episode.episode_number - 1];
    for (let shot = 1; shot <= episodePlan.shots; shot += 1) {
      const duration = Number((plan.project.episode_duration_seconds / episodePlan.shots).toFixed(1));
      db.prepare(`INSERT INTO storyboards
        (episode_id, scene_id, storyboard_number, title, description, duration, dialogue, narration, action, image_prompt, video_prompt, characters, shot_type, movement, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prompt_ready', ?, ?)`)
        .run(episode.id, scene.lastInsertRowid, shot, `镜头 ${shot}`, `${episodePlan.synopsis} · 节拍 ${shot}`, duration,
          shot % 2 === 0 ? '我不会再按别人的剧本活下去。' : '', shot === 1 ? episodePlan.synopsis : '', '人物完成明确动作并推动冲突',
          `${plan.project.visual_style}，9:16，角色一致，电影级光影，镜头${shot}`, '轻微推镜，人物自然动作，画面稳定', JSON.stringify(characterIds.slice(0, 2)), shot % 3 === 0 ? 'close_up' : 'medium', 'slow_push_in', now, now);
    }
  }
  return { characters: characterIds.length, episodes: episodes.length, shots: plan.estimated.shots };
}

function generateMockMedia(db, run) {
  const now = new Date().toISOString();
  const shots = db.prepare(`SELECT s.*, e.id AS episode_id FROM storyboards s
    INNER JOIN episodes e ON e.id = s.episode_id WHERE e.drama_id = ? ORDER BY e.episode_number, s.storyboard_number`).all(run.project_id);
  const videoLimit = run.plan.estimated.videos;
  let actualCost = 0;
  shots.forEach((shot, index) => {
    const operation = index < videoLimit ? 'video' : 'image';
    const cost = operation === 'video' ? 0.55 : 0.035;
    actualCost += cost;
    db.prepare(`INSERT INTO generation_usage
      (id, run_id, project_id, episode_id, shot_id, provider, model, operation, quantity, estimated_cost, actual_cost, external_task_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'mock-local', 'deterministic-v1', ?, 1, ?, ?, ?, ?)`)
      .run(uuidv4(), run.id, run.project_id, shot.episode_id, shot.id, operation, cost, cost, `mock-${shot.id}`, now);
    db.prepare(`INSERT INTO qc_reports
      (id, project_id, episode_id, shot_id, asset_type, asset_id, checks_json, score, decision, recommended_action, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 100, 'PASS', '无需处理', ?)`)
      .run(uuidv4(), run.project_id, shot.episode_id, shot.id, operation, String(shot.id), JSON.stringify([
        { key: 'file_integrity', passed: true }, { key: 'aspect_ratio_9_16', passed: true }, { key: 'duration', passed: true },
      ]), now);
    db.prepare("UPDATE storyboards SET status = 'ready', result = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify({ mock: true, operation, qc: 'PASS' }), now, shot.id);
  });
  db.prepare('UPDATE agent_runs SET actual_cost = ?, updated_at = ? WHERE id = ?').run(Number(actualCost.toFixed(2)), now, run.id);
  return { shots: shots.length, videos: Math.min(videoLimit, shots.length), qc_passed: shots.length, actual_cost: Number(actualCost.toFixed(2)) };
}

function approve(db, approvalId, decision, comment = '') {
  const approval = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(approvalId);
  if (!approval) return null;
  if (approval.status !== 'PENDING') throw new Error('该审核已处理');
  const now = new Date().toISOString();
  const run = getRun(db, approval.run_id);
  if (!run || TERMINAL.has(run.status)) throw new Error('运行已结束');
  if (decision === 'reject' && !String(comment).trim()) throw new Error('驳回时必须填写修改意见');
  if (decision === 'approve' && !run.dry_run) {
    const snapshot = parseJson(approval.snapshot_json, {});
    if (approval.approval_stage === 'assets' && Number(snapshot.reference_images_completed || 0) < 1) {
      const err = new Error('角色和场景参考图尚未生成成功，请修复图片模型配置后点击“驳回修改”，再按意见重新生成。');
      err.code = 'CONFIGURATION_BLOCKED';
      throw err;
    }
    if (approval.approval_stage === 'final_video' && Number(snapshot.videos_completed || 0) < 1) {
      const err = new Error('尚无视频片段可供合成，请先修复失败镜头并重新生成。');
      err.code = 'CONFIGURATION_BLOCKED';
      throw err;
    }
  }
  const tx = db.transaction(() => {
    db.prepare('UPDATE approval_requests SET status = ?, reviewer_comment = ?, resolved_at = ? WHERE id = ?')
      .run(decision === 'approve' ? 'APPROVED' : 'REJECTED', comment, now, approvalId);
    if (decision === 'reject') {
      db.prepare("UPDATE agent_runs SET status = 'PAUSED', current_step = ?, updated_at = ? WHERE id = ?").run(`revision_required:${approval.approval_stage}`, now, run.id);
      insertStep(db, run.id, `rejected_${approval.approval_stage}`, 'approval', 'COMPLETED', { decision, comment });
      return;
    }
    if (approval.approval_stage === 'script') {
      if (!run.dry_run) {
        db.prepare("UPDATE agent_runs SET status = 'ASSET_GENERATING', current_step = 'generating:assets', updated_at = ? WHERE id = ?").run(now, run.id);
        return;
      }
      const result = generateAssets(db, run);
      insertStep(db, run.id, 'assets_generated', 'assets', 'COMPLETED', result);
      createApproval(db, run.id, run.project_id, 'assets', result);
      db.prepare("UPDATE agent_runs SET status = 'ASSET_REVIEW', current_step = 'asset_review', updated_at = ? WHERE id = ?").run(now, run.id);
    } else if (approval.approval_stage === 'assets') {
      if (!run.dry_run) {
        db.prepare("UPDATE agent_runs SET status = 'MEDIA_GENERATING', current_step = 'generating:media', updated_at = ? WHERE id = ?").run(now, run.id);
        return;
      }
      const result = generateMockMedia(db, run);
      insertStep(db, run.id, 'mock_media_generated', 'media', 'COMPLETED', result);
      insertStep(db, run.id, 'quality_checked', 'quality', 'COMPLETED', { decision: 'PASS', reports: result.qc_passed });
      createApproval(db, run.id, run.project_id, 'final_video', result);
      db.prepare("UPDATE agent_runs SET status = 'FINAL_REVIEW', current_step = 'final_review', updated_at = ? WHERE id = ?").run(now, run.id);
    } else if (approval.approval_stage === 'final_video') {
      if (!run.dry_run) {
        db.prepare("UPDATE agent_runs SET status = 'EXPORTING', current_step = 'generating:export', updated_at = ? WHERE id = ?").run(now, run.id);
        return;
      }
      insertStep(db, run.id, 'export_ready', 'export', 'COMPLETED', { project_id: run.project_id });
      db.prepare("UPDATE agent_runs SET status = 'EXPORTED', current_step = 'complete', updated_at = ? WHERE id = ?").run(now, run.id);
      db.prepare("UPDATE dramas SET status = 'completed', updated_at = ? WHERE id = ?").run(now, run.project_id);
    }
  });
  tx();
  return getRun(db, approval.run_id);
}

function controlRun(db, runId, action) {
  const run = getRun(db, runId);
  if (!run) return null;
  const now = new Date().toISOString();
  if (action === 'cancel') {
    db.prepare("UPDATE agent_runs SET status = 'CANCELLED', current_step = 'cancelled', updated_at = ? WHERE id = ?").run(now, runId);
  } else if (action === 'pause' && !TERMINAL.has(run.status)) {
    db.prepare("UPDATE agent_runs SET status = 'PAUSED', current_step = ?, updated_at = ? WHERE id = ?").run(`paused:${run.status}`, now, runId);
  } else if ((action === 'resume' || action === 'retry') && run.status === 'PAUSED') {
    if (String(run.current_step || '').startsWith('paused:')) {
      const previousStatus = String(run.current_step).slice('paused:'.length);
      db.prepare('UPDATE agent_runs SET status = ?, current_step = ?, updated_at = ? WHERE id = ?')
        .run(previousStatus, 'resumed', now, runId);
    } else {
      const stageFromStep = String(run.current_step || '').split(':')[1];
      const lastRejected = db.prepare("SELECT * FROM approval_requests WHERE run_id = ? AND status = 'REJECTED' ORDER BY resolved_at DESC LIMIT 1").get(runId);
      const stage = stageFromStep || lastRejected?.approval_stage || 'script';
      if (!run.dry_run) {
        const realAction = ({ script: 'script', assets: 'assets', final_video: 'media' })[stage] || 'script';
        const realStatus = ({ script: 'SCRIPT_GENERATING', assets: 'ASSET_GENERATING', media: 'MEDIA_GENERATING' })[realAction];
        db.prepare('UPDATE agent_runs SET status = ?, current_step = ?, updated_at = ? WHERE id = ?')
          .run(realStatus, `generating:${realAction}`, now, runId);
      } else {
        createApproval(db, runId, run.project_id, stage, { revision: lastRejected?.reviewer_comment || '恢复审核' });
        db.prepare('UPDATE agent_runs SET status = ?, current_step = ?, updated_at = ? WHERE id = ?')
          .run(REVIEW_STATUS[stage], `${stage}_review`, now, runId);
      }
    }
  } else if (action === 'retry' && run.status === 'FAILED' && !run.dry_run) {
    const failedAction = String(run.current_step || '').split(':')[1] || 'script';
    const status = ({ script: 'SCRIPT_GENERATING', assets: 'ASSET_GENERATING', media: 'MEDIA_GENERATING', export: 'EXPORTING' })[failedAction] || 'SCRIPT_GENERATING';
    db.prepare('UPDATE agent_runs SET status = ?, current_step = ?, updated_at = ? WHERE id = ?')
      .run(status, `generating:${failedAction}`, now, runId);
  }
  return getRun(db, runId);
}

function listApprovals(db, status = 'PENDING') {
  const where = status ? 'WHERE a.status = ?' : '';
  const args = status ? [status] : [];
  return db.prepare(`SELECT a.*, d.title AS project_title FROM approval_requests a
    LEFT JOIN dramas d ON d.id = a.project_id ${where} ORDER BY a.created_at DESC`).all(...args)
    .map((row) => ({ ...row, snapshot: parseJson(row.snapshot_json, {}) }));
}

function getProjectCosts(db, projectId) {
  const run = db.prepare('SELECT * FROM agent_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId);
  if (!run) return null;
  const byOperation = db.prepare(`SELECT operation, COUNT(*) AS count, ROUND(SUM(actual_cost), 2) AS actual_cost
    FROM generation_usage WHERE project_id = ? GROUP BY operation`).all(projectId);
  return { budget_limit: run.budget_limit, estimated_cost: run.estimated_cost, actual_cost: run.actual_cost, usage_by_operation: byOperation };
}

module.exports = { createPlan, createRun, getRun, listRuns, approve, controlRun, listApprovals, getProjectCosts };
