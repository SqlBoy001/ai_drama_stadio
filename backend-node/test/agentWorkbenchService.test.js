const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runMigrationsAndEnsure } = require('../src/db/migrate');
const service = require('../src/services/agentWorkbenchService');
const production = require('../src/services/agentProductionService');
const aiConfigService = require('../src/services/aiConfigService');
const imageClient = require('../src/services/imageClient');
const { createPlan } = service;

const silentLog = { info() {}, warn() {}, error() {}, errorw() {} };

function createTestDb() {
  const db = new Database(':memory:');
  runMigrationsAndEnsure(db);
  return db;
}

test('createPlan parses core constraints and remains dry-run', () => {
  const plan = createPlan({ instruction: '做一个《逆风翻盘》的3集都市短剧，每集45秒，预算300元' });
  assert.equal(plan.project.title, '逆风翻盘');
  assert.equal(plan.project.episode_count, 3);
  assert.equal(plan.project.episode_duration_seconds, 45);
  assert.equal(plan.estimated.budget_limit, 300);
  assert.equal(plan.dry_run, true);
  assert.deepEqual(plan.approval_gates, ['script', 'assets', 'final_video']);
});

test('createPlan clamps V1 scope and estimates a consistent shot count', () => {
  const plan = createPlan({ instruction: '做20集，每集5秒', budget_limit: 999 });
  assert.equal(plan.project.episode_count, 10);
  assert.equal(plan.project.episode_duration_seconds, 30);
  assert.equal(plan.estimated.shots, 60);
  assert.equal(plan.episodes.length, 10);
});

test('createPlan rejects an empty instruction', () => {
  assert.throws(() => createPlan({}), /请输入一句短剧创意/);
});

test('createPlan supports an explicitly confirmed real production mode', () => {
  const plan = createPlan({ instruction: '做一部1集短剧', dry_run: false, budget_limit: 100 });
  assert.equal(plan.dry_run, false);
  assert.equal(plan.providers.text, '自动选择默认配置');
});

test('createPlan automatically routes suspense stories to the realistic suspense art direction', () => {
  const plan = createPlan({
    instruction: '做一部都市怪谈悬疑漫剧，女主收到预告死亡的弹幕',
    genre: '悬疑反转',
    visual_style: '2.5D国漫',
    visual_style_auto: true,
  });
  assert.equal(plan.project.visual_style, 'urban suspense cinematic');
  assert.equal(plan.project.visual_style_auto, true);
  assert.match(plan.project.visual_style_prompt_zh, /真人比例/);
  assert.match(plan.project.visual_style_prompt_zh, /低调布光/);
  assert.match(plan.project.visual_style_prompt_en, /psychological suspense/i);
});

test('createPlan preserves a manually selected style for suspense stories', () => {
  const plan = createPlan({
    instruction: '做一部悬疑漫剧',
    genre: '悬疑反转',
    visual_style: '水墨国风',
    visual_style_auto: false,
  });
  assert.equal(plan.project.visual_style, '水墨国风');
  assert.equal(plan.project.visual_style_auto, false);
});

test('createRun persists complete suspense art prompts in project metadata', () => {
  const db = createTestDb();
  try {
    const plan = createPlan({
      instruction: '做一部都市悬疑漫剧',
      genre: '悬疑反转',
      visual_style_auto: true,
      budget_limit: 999,
    });
    const run = service.createRun(db, silentLog, { plan, budget_limit: 999 });
    const drama = db.prepare('SELECT style, metadata FROM dramas WHERE id = ?').get(run.project_id);
    const metadata = JSON.parse(drama.metadata);
    assert.equal(drama.style, 'urban suspense cinematic');
    assert.equal(metadata.style_prompt_zh, plan.project.visual_style_prompt_zh);
    assert.equal(metadata.style_prompt_en, plan.project.visual_style_prompt_en);
  } finally {
    db.close();
  }
});

test('cost control keeps every final shot dynamic instead of replacing shots with still motion', () => {
  const plan = createPlan({
    instruction: '做一部1集30秒的系统悬疑漫剧',
    episode_count: 1,
    episode_duration_seconds: 30,
    save_cost: true,
  });
  assert.equal(plan.estimated.videos, plan.estimated.shots);
  assert.match(plan.cost_strategy, /全部镜头动态化/);
  assert.match(plan.cost_strategy, /智能模型路由/);
});

test('video model routing reserves flagship models for complex shots', () => {
  const config = {
    default_model: 'doubao-seedance-2-5-260628',
    model: [
      'doubao-seedance-2-5-260628',
      'doubao-seedance-2-0-260128',
      'doubao-seedance-2-0-mini-260615',
      'doubao-seedance-2-0-fast-260128',
      'doubao-seedance-1-5-pro-251215',
    ],
  };
  assert.equal(production.selectVideoModel({ characters: '[]', dialogue: '', action: '雨夜街道空镜，霓虹灯闪烁' }, config), 'doubao-seedance-2-0-mini-260615');
  assert.equal(production.selectVideoModel({ characters: '[1]', dialogue: '', action: '人物缓慢走入房间' }, config), 'doubao-seedance-2-0-fast-260128');
  assert.equal(production.selectVideoModel({ characters: '[1]', dialogue: '别动。', action: '人物看向镜头' }, config), 'doubao-seedance-1-5-pro-251215');
  assert.equal(production.selectVideoModel({ characters: '[1,2]', dialogue: '', action: '两人在走廊尽头对视' }, config), 'doubao-seedance-2-0-260128');
  assert.equal(production.selectVideoModel({ characters: '[1,2]', dialogue: '真相就在这里。', action: '两人争抢证据并猛然转身' }, config), 'doubao-seedance-2-5-260628');
});

test('real production creates an empty project and waits for asynchronous script generation', () => {
  const db = createTestDb();
  try {
    const plan = createPlan({ instruction: '做一部《真实测试》的1集短剧', dry_run: false, budget_limit: 100 });
    const run = service.createRun(db, silentLog, { plan, dry_run: false, budget_limit: 100 });
    assert.equal(run.dry_run, false);
    assert.equal(run.status, 'SCRIPT_GENERATING');
    assert.equal(run.approvals.length, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM episodes WHERE drama_id = ?').get(run.project_id).n, 0);
  } finally {
    db.close();
  }
});

test('provider preflight treats TTS as optional and never exposes API keys', () => {
  const db = createTestDb();
  try {
    for (const serviceType of ['text', 'image', 'storyboard_image', 'video']) {
      aiConfigService.createConfig(db, silentLog, {
        service_type: serviceType,
        provider: 'test-provider',
        name: `${serviceType} config`,
        base_url: 'https://example.invalid/v1',
        api_key: 'secret-must-not-leak',
        model: [`${serviceType}-model`],
        default_model: `${serviceType}-model`,
        is_default: true,
      });
    }
    const status = production.getProviderStatus(db);
    assert.equal(status.ready, true);
    assert.equal(status.operational_ready, true);
    assert.equal(status.capabilities.find((item) => item.service_type === 'tts').required, false);
    assert.equal(JSON.stringify(status).includes('secret-must-not-leak'), false);
  } finally {
    db.close();
  }
});

test('provider status surfaces a known model capability failure without leaking request details', () => {
  const db = createTestDb();
  try {
    aiConfigService.createConfig(db, silentLog, {
      service_type: 'image', provider: 'volcengine', name: 'Seedream', base_url: 'https://example.invalid/v1',
      api_key: 'secret', model: ['seedream-test'], default_model: 'seedream-test', is_default: true,
    });
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO image_generations
      (provider, model, status, error_msg, created_at, updated_at)
      VALUES ('volcengine', 'seedream-test', 'failed', ?, ?, ?)`).run(
      'ModelNotOpen: has not activated the model. Request id: private-request-id', now, now
    );
    const status = production.getProviderStatus(db);
    const image = status.capabilities.find((item) => item.service_type === 'image');
    assert.match(image.known_issue, /尚未开通模型/);
    assert.equal(image.operational, false);
    assert.equal(status.operational_ready, false);
    assert.equal(JSON.stringify(status).includes('private-request-id'), false);
  } finally {
    db.close();
  }
});

test('storyboard image selection can explicitly fall back to a normal image model', () => {
  const db = createTestDb();
  try {
    aiConfigService.createConfig(db, silentLog, {
      service_type: 'storyboard_image', provider: 'volcengine', name: 'Storyboard', base_url: 'https://example.invalid/v1',
      api_key: 'secret', model: ['storyboard-model'], default_model: 'storyboard-model', is_default: true,
    });
    aiConfigService.createConfig(db, silentLog, {
      service_type: 'image', provider: 'openai', name: 'Fallback', base_url: 'https://example.invalid/v1',
      api_key: 'secret', model: ['fallback-image-model'], default_model: 'fallback-image-model', is_default: true,
    });
    const selected = imageClient.getDefaultImageConfig(db, 'fallback-image-model', null, 'storyboard_image');
    assert.equal(selected.default_model, 'fallback-image-model');
  } finally {
    db.close();
  }
});

test('real storyboard output is merged back to the approved shot count without losing story beats', () => {
  const db = createTestDb();
  try {
    const now = new Date().toISOString();
    const drama = db.prepare(`INSERT INTO dramas (title, created_at, updated_at) VALUES ('分镜校准', ?, ?)`).run(now, now);
    const episode = db.prepare(`INSERT INTO episodes
      (drama_id, episode_number, title, script_content, duration, created_at, updated_at)
      VALUES (?, 1, '第一集', '测试', 30, ?, ?)`).run(drama.lastInsertRowid, now, now);
    for (let index = 1; index <= 7; index += 1) {
      db.prepare(`INSERT INTO storyboards
        (episode_id, scene_id, storyboard_number, title, action, dialogue, image_prompt, characters, duration, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5, ?, ?)`).run(
        episode.lastInsertRowid,
        index <= 2 || index >= 6 ? index : 99,
        index,
        `节拍${index}`,
        `动作${index}`,
        index === 5 ? '关键对白' : '',
        `镜头画面${index}`,
        JSON.stringify(index === 5 ? [1, 2] : [1]),
        now,
        now
      );
    }
    const result = production.normalizeEpisodeStoryboards(db, episode.lastInsertRowid, 6, 30);
    const active = db.prepare(`SELECT * FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL
      ORDER BY storyboard_number`).all(episode.lastInsertRowid);
    assert.deepEqual(result, { count: 6, merged: 1, duration: 30 });
    assert.equal(active.length, 6);
    assert.deepEqual(active.map((row) => row.storyboard_number), [1, 2, 3, 4, 5, 6]);
    assert.equal(active.reduce((sum, row) => sum + row.duration, 0), 30);
    assert.ok(active.some((row) => row.action.includes('动作4') && row.action.includes('动作5')));
    assert.ok(active.some((row) => row.dialogue.includes('关键对白')));
    assert.ok(active.some((row) => row.image_prompt.includes('禁止分屏') && row.image_prompt.includes('镜头画面4') && row.image_prompt.includes('镜头画面5')));
  } finally {
    db.close();
  }
});

test('image connection test rejects a configured but unavailable model', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 404,
    text: async () => JSON.stringify({ error: { code: 'ModelNotOpen', message: 'has not activated the model' } }),
  });
  try {
    await assert.rejects(() => aiConfigService.testConnection({
      service_type: 'image', provider: 'volcengine', base_url: 'https://example.invalid/v1',
      api_key: 'secret', model: ['seedream-test'], endpoint: '/images/generations',
    }), /模型不可用/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('real asset approval is blocked when every reference image failed', () => {
  const db = createTestDb();
  try {
    const plan = createPlan({ instruction: '做一部《配置保护》的1集短剧', dry_run: false, budget_limit: 100 });
    const run = service.createRun(db, silentLog, { plan, dry_run: false, budget_limit: 100 });
    const approvalId = 'asset-approval-without-images';
    db.prepare(`INSERT INTO approval_requests
      (id, run_id, project_id, target_type, target_id, approval_stage, snapshot_json, status, created_at)
      VALUES (?, ?, ?, 'assets', ?, 'assets', ?, 'PENDING', ?)`).run(
      approvalId, run.id, run.project_id, String(run.project_id), JSON.stringify({ reference_images_completed: 0 }), new Date().toISOString()
    );
    db.prepare("UPDATE agent_runs SET status = 'ASSET_REVIEW', current_step = 'asset_review' WHERE id = ?").run(run.id);
    assert.throws(() => service.approve(db, approvalId, 'approve'), /参考图尚未生成成功/);
  } finally {
    db.close();
  }
});

test('dry-run production advances through all three approval gates', () => {
  const db = createTestDb();
  try {
    let run = service.createRun(db, silentLog, {
      instruction: '做一个《测试短剧》的1集都市故事，每集30秒，预算100元',
      episode_count: 1,
      episode_duration_seconds: 30,
      budget_limit: 100,
    });
    assert.equal(run.status, 'SCRIPT_REVIEW');
    run = service.approve(db, run.approvals.find((a) => a.status === 'PENDING').id, 'approve');
    assert.equal(run.status, 'ASSET_REVIEW');
    run = service.approve(db, run.approvals.find((a) => a.status === 'PENDING').id, 'approve');
    assert.equal(run.status, 'FINAL_REVIEW');
    assert.equal(run.usage.length, 6);
    assert.equal(run.qc_reports.length, 6);
    run = service.approve(db, run.approvals.find((a) => a.status === 'PENDING').id, 'approve');
    assert.equal(run.status, 'EXPORTED');
    assert.ok(run.steps.some((step) => step.step_key === 'export_ready'));
  } finally {
    db.close();
  }
});

test('rejection requires feedback and resume recreates the same gate', () => {
  const db = createTestDb();
  try {
    let run = service.createRun(db, silentLog, { instruction: '做一部1集短剧，预算100元', budget_limit: 100 });
    const approvalId = run.approvals.find((a) => a.status === 'PENDING').id;
    assert.throws(() => service.approve(db, approvalId, 'reject', ''), /必须填写修改意见/);
    run = service.approve(db, approvalId, 'reject', '加强第一幕冲突');
    assert.equal(run.status, 'PAUSED');
    run = service.controlRun(db, run.id, 'resume');
    assert.equal(run.status, 'SCRIPT_REVIEW');
    assert.equal(run.approvals.filter((a) => a.status === 'PENDING').length, 1);
  } finally {
    db.close();
  }
});

test('manual pause resumes the exact review stage without duplicating approvals', () => {
  const db = createTestDb();
  try {
    let run = service.createRun(db, silentLog, { instruction: '做一部1集短剧，预算100元', budget_limit: 100 });
    run = service.approve(db, run.approvals.find((a) => a.status === 'PENDING').id, 'approve');
    assert.equal(run.status, 'ASSET_REVIEW');
    run = service.controlRun(db, run.id, 'pause');
    assert.equal(run.status, 'PAUSED');
    run = service.controlRun(db, run.id, 'resume');
    assert.equal(run.status, 'ASSET_REVIEW');
    assert.equal(run.approvals.filter((a) => a.status === 'PENDING').length, 1);
  } finally {
    db.close();
  }
});
