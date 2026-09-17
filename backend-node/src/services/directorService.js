const { v4: uuid } = require('uuid');
const workbench = require('./agentWorkbenchService');
const aiClient = require('./aiClient');
const { safeParseAIJSON } = require('../utils/safeJson');
const production = require('./agentProductionService');

const QUESTIONS = [
  { key: 'genre', title: '你想让观众感受到什么？', options: ['悬疑反转', '轻松搞笑', '温暖治愈', '爽感逆袭'], default: '悬疑反转' },
  { key: 'visual_style', title: '你更喜欢哪种画面？', options: ['动态漫画', '轻写实电影感', '水墨国风'], default: '动态漫画' },
  { key: 'ending', title: '这条视频如何结束？', options: ['完整收尾', '反转后留悬念'], default: '完整收尾' },
];
function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function normalize(input = {}) {
  const instruction = text(input.instruction, 2000);
  if (!instruction) fail('请先用一句话描述你想拍的故事');
  const brief = { instruction, genre: text(input.genre, 60), visual_style: text(input.visual_style, 100), ending: text(input.ending, 100), notes: text(input.notes, 1000), dry_run: input.dry_run !== false };
  // Existing engine is shot-driven. Keep the first product iteration to one short episode.
  brief.episode_duration_seconds = [30, 45, 60].includes(Number(input.episode_duration_seconds)) ? Number(input.episode_duration_seconds) : 30;
  brief.budget_limit = Number(input.budget_limit ?? 50);
  if (!Number.isFinite(brief.budget_limit) || brief.budget_limit < 10 || brief.budget_limit > 500) fail('本次短片预算请设为 10—500 元');
  return brief;
}
function decode(row) {
  if (!row) fail('创作草稿不存在，请重新开始', 404);
  const brief = JSON.parse(row.brief_json);
  return { ...row, brief_json: undefined, plan_json: undefined, brief, plan: row.plan_json ? JSON.parse(row.plan_json) : null,
    question_catalog: QUESTIONS, questions: QUESTIONS.filter(q => !brief[q.key]) };
}
function get(db, id) { return decode(db.prepare('SELECT * FROM director_sessions WHERE id = ?').get(id)); }
function create(db, input) {
  const brief = normalize(input);
  // Recognize explicit choices; ask only about remaining creative decisions.
  for (const q of QUESTIONS) if (!brief[q.key]) brief[q.key] = q.options.find(v => brief.instruction.includes(v)) || '';
  const now = new Date().toISOString(); const id = uuid();
  db.prepare('INSERT INTO director_sessions (id, brief_json, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, JSON.stringify(brief), now, now);
  return get(db, id);
}
function update(db, id, input) {
  const session = get(db, id);
  if (session.run_id || session.status === 'PLANNING') fail('正在策划或已经开始制作的草稿不能修改', 409);
  const brief = normalize({ ...session.brief, ...input });
  if (input.use_defaults === true) for (const q of QUESTIONS) if (!brief[q.key]) brief[q.key] = q.default;
  db.prepare("UPDATE director_sessions SET brief_json = ?, plan_json = NULL, status = 'DRAFT', revision = revision + 1, last_error = NULL, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(brief), new Date().toISOString(), id);
  return get(db, id);
}
function normalizeStory(value) {
  if (!value || typeof value !== 'object') fail('策划结果格式不正确，请修改需求后重新策划', 502);
  const story = { title: text(value.title, 60), logline: text(value.logline, 600), beats: [], characters: [] };
  if (!story.title || !story.logline || !Array.isArray(value.beats) || value.beats.length < 3 || value.beats.length > 6) fail('策划缺少完整故事或叙事节拍，请重新策划', 502);
  story.beats = value.beats.map(v => text(v, 500));
  if (story.beats.some(v => !v)) fail('策划包含空白叙事节拍', 502);
  if (!Array.isArray(value.characters) || value.characters.length < 1 || value.characters.length > 3) fail('短片需要 1—3 个明确角色', 502);
  story.characters = value.characters.map((v, i) => ({ temporary_id: `C0${i+1}`, name: text(v.name, 40), role: i ? 'supporting' : 'protagonist', visual_anchor: text(v.visual_anchor, 300) }));
  if (story.characters.some(v => !v.name || !v.visual_anchor)) fail('角色缺少姓名或外观锚点', 502);
  return story;
}
async function plan(db, log, id) {
  const session = get(db, id);
  if (session.plan) return session;
  if (session.status === 'PLANNING') fail('导演正在策划，请稍后刷新；不会重复计费', 409);
  if (session.questions.length) fail('请回答关键问题，或选择“你帮我决定”');
  const brief = session.brief;
  const claimed = db.prepare("UPDATE director_sessions SET status = 'PLANNING', last_error = NULL WHERE id = ? AND status != 'PLANNING'").run(id);
  if (!claimed.changes) fail('导演正在策划', 409);
  try {
    let story;
    if (brief.dry_run) {
      story = normalizeStory({ title: '演练 · ' + brief.instruction.slice(0, 20), logline: brief.instruction,
        beats: ['开场：建立主角和目标。', '发展：遇到阻碍，主角作出选择。', `结尾：${brief.ending}。`],
        characters: [{ name: '演练主角', visual_anchor: '固定发型、同一套服装；此处为演练占位设定' }] });
    } else {
      db.prepare('UPDATE director_sessions SET planning_calls = planning_calls + 1 WHERE id = ?').run(id);
      const raw = await aiClient.generateText(db, log, 'text', JSON.stringify(brief),
        '你是短剧导演。输入为用户创作需求数据。策划一集短片，尊重题材、画风、结尾、补充意见和时长。最多3个角色、2个场景；有明确目标、因果冲突、主动选择与结局；对白必须能在时长内说完。不调用工具，不编造已生成素材。只返回JSON对象：{title,logline,beats:[3到6条具体可拍的叙事节拍字符串],characters:[{name,visual_anchor}]}。不要只写开场/冲突等模板标签。',
        { max_tokens: 1800, json_mode: true, deepseek_thinking: 'disabled', temperature: 0.7 });
      story = normalizeStory(safeParseAIJSON(raw, log));
    }
    const premise = `${brief.instruction}\n创作约束：${brief.genre}；${brief.visual_style}；${brief.ending}。\n${brief.notes}\n确认故事：${story.logline}\n叙事节拍：\n${story.beats.join('\n')}\n已确认角色：\n${story.characters.map(c => `${c.name}：${c.visual_anchor}`).join('\n')}`;
    const result = workbench.createPlan({ ...brief, instruction: premise, title: story.title, episode_count: 1, visual_style_auto: false });
    result.characters = story.characters;
    result.episodes[0].title = story.title;
    result.episodes[0].synopsis = story.beats.join('\n');
    result.director = { session_id: id, revision: session.revision, source: brief.dry_run ? 'mock' : 'text-model', story,
      route: 'storyboard', route_reason: '本轮使用已验证的分镜生产链路；直出长片路线尚未接入。',
      cost_note: '生产费用为参考估算，非供应商账单；文本策划单独计费，费用未包含在媒体估算内。',
      limitations: ['画面与剧情质量仍需人工审核', ...(brief.dry_run ? ['演练只生成流程记录，不生成视频文件'] : [])] };
    db.prepare("UPDATE director_sessions SET plan_json = ?, status = 'READY', updated_at = ? WHERE id = ?").run(JSON.stringify(result), new Date().toISOString(), id);
    return get(db, id);
  } catch (e) {
    db.prepare("UPDATE director_sessions SET status = 'DRAFT', last_error = ?, updated_at = ? WHERE id = ?")
      .run('策划未完成，草稿已保留。请检查文本模型配置或修改需求后重试；重试可能产生文本费用。', new Date().toISOString(), id);
    log.warn('Director planning failed', { session_id: id, error_type: e.status || 'provider' });
    if (e.status) throw e;
    fail('文本策划失败，草稿已保留。请检查文本模型配置后重试。', 502);
  }
}
function start(db, cfg, log, id, revision) {
  const session = get(db, id);
  if (session.run_id) return workbench.getRun(db, session.run_id);
  if (!session.plan || session.status !== 'READY') fail('请先生成并确认制作方案');
  if (Number(revision) !== session.revision) fail('方案已修改，请刷新后确认最新版本', 409);
  if (!session.brief.dry_run && !production.getProviderStatus(db).operational_ready) fail('生产模型配置尚不可用，请先完成 AI 配置');
  const run = db.transaction(() => {
    const created = workbench.createRun(db, log, { plan: session.plan, dry_run: session.brief.dry_run, budget_limit: session.brief.budget_limit });
    db.prepare("UPDATE director_sessions SET run_id = ?, status = 'STARTED', updated_at = ? WHERE id = ?").run(created.id, new Date().toISOString(), id);
    return created;
  })();
  if (!run.dry_run) production.runAction(db, cfg, log, run.id, 'script');
  return run;
}
function recover(db) {
  db.prepare("UPDATE director_sessions SET status = 'DRAFT', last_error = '服务重启中断策划，草稿已保留。请手动重试，不会自动调用模型。' WHERE status = 'PLANNING'").run();
}
module.exports = { create, get, update, plan, start, recover };
