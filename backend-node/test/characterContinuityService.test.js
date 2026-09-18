const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const continuity = require('../src/services/characterContinuityService');
const promptI18n = require('../src/services/promptI18n');

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE episodes (id INTEGER PRIMARY KEY, drama_id INTEGER, deleted_at TEXT);
    CREATE TABLE characters (
      id INTEGER PRIMARY KEY,
      drama_id INTEGER,
      name TEXT,
      appearance TEXT,
      deleted_at TEXT
    );
    CREATE TABLE storyboards (
      id INTEGER PRIMARY KEY,
      episode_id INTEGER,
      storyboard_number INTEGER,
      title TEXT,
      characters TEXT,
      action TEXT,
      result TEXT,
      image_prompt TEXT,
      video_prompt TEXT,
      continuity_snapshot TEXT,
      image_url TEXT,
      local_path TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE video_generations (
      id INTEGER PRIMARY KEY,
      storyboard_id INTEGER,
      prompt TEXT,
      status TEXT,
      deleted_at TEXT
    );
    INSERT INTO episodes (id, drama_id) VALUES (5, 3);
    INSERT INTO characters (id, drama_id, name, appearance) VALUES
      (8, 3, '林晚', '女性，黑色长直发。身穿浅灰色居家卫衣和深色长裤，脚踩白色帆布鞋。'),
      (9, 3, '苏晴', '女性，浅棕色长卷发。身穿米白色针织开衫搭配浅色长裙，脚踩浅色平底鞋。');
  `);
  const insert = db.prepare(`
    INSERT INTO storyboards
      (id, episode_id, storyboard_number, title, characters, action, result, image_prompt, video_prompt, image_url)
    VALUES (?, 5, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(52, 3, '电梯门开苏晴现', '[8,9]',
    '苏晴穿一袭红裙站在轿厢正中。', '苏晴站在暖光中微笑。',
    '苏晴穿一袭红裙站在正中。', '苏晴穿一袭红裙站在正中。', '/old/shot3.jpg');
  insert.run(53, 4, '迈步与血红警告', '[8,9]',
    '林晚迈进电梯，苏晴伸手相迎。', '两人在门框两侧对视。',
    '林晚迈进电梯，苏晴伸手相迎。', '林晚迈进电梯，苏晴伸手相迎。', '/old/shot4.jpg');
  insert.run(54, 5, '裙摆滴水真相', '[9]',
    '镜头对准苏晴胸口处的红裙与湿透的裙摆。', '红裙仍在滴水。',
    '苏晴胸口处的红裙，湿透的裙摆。', '红裙下摆持续滴水。', '/old/shot5.jpg');
  insert.run(55, 6, '林晚倒退定格', '[8,9]',
    '苏晴微笑不变，红裙下摆仍在滴水。', '两人隔着门框对视。',
    '苏晴微笑不变，红裙下摆仍在滴水。', '苏晴红裙下摆仍在滴水。', '/old/shot6.jpg');
  for (const id of [52, 53, 54, 55]) {
    db.prepare('INSERT INTO video_generations (storyboard_id, prompt, status) VALUES (?, ?, ?)')
      .run(id, '旧视频提示词', 'completed');
  }
  return db;
}

test('auditEpisodeContinuity locks the first explicit story wardrobe across adjacent shots', () => {
  const db = createDb();
  const result = continuity.auditEpisodeContinuity(db, 5, { apply: true });

  assert.equal(result.applied, true);
  assert.deepEqual(result.affected_storyboard_numbers, [3, 4, 5, 6]);
  assert.deepEqual(result.regenerate_storyboard_numbers, [3, 4, 5, 6]);
  assert.deepEqual(result.regenerate_video_storyboard_numbers, [3, 4, 5, 6]);
  assert.ok(result.issues.some((issue) => issue.type === 'reference_outfit_conflict' && issue.character_name === '苏晴'));
  assert.ok(result.issues.some((issue) => issue.type === 'inherited_wardrobe' && issue.storyboard_number === 4));

  const rows = db.prepare('SELECT storyboard_number, continuity_snapshot FROM storyboards ORDER BY storyboard_number').all();
  for (const row of rows) {
    const snapshot = JSON.parse(row.continuity_snapshot);
    assert.match(snapshot.characters['苏晴'].clothing, /红裙/);
    assert.equal(snapshot.characters['苏晴'].locked, true);
  }
});

test('an explicit wardrobe transition is allowed and becomes the new state', () => {
  const db = createDb();
  db.prepare('UPDATE storyboards SET action = ? WHERE id = 54').run('苏晴脱下红裙，换上黑色长裙。');

  const result = continuity.auditEpisodeContinuity(db, 5, { apply: true });
  const shot5 = JSON.parse(db.prepare('SELECT continuity_snapshot FROM storyboards WHERE id = 54').get().continuity_snapshot);

  assert.match(shot5.characters['苏晴'].clothing, /黑色长裙/);
  assert.ok(!result.issues.some((issue) => issue.type === 'unexpected_wardrobe_change' && issue.storyboard_number === 5));
});

test('prompt lock makes storyboard wardrobe authoritative over character reference clothing', () => {
  const db = createDb();
  continuity.auditEpisodeContinuity(db, 5, { apply: true });

  const locked = continuity.applyStoryboardContinuityLock(db, 53, '林晚迈进电梯，苏晴伸手相迎。');
  assert.match(locked, /人物服装连戏最高优先级/);
  assert.match(locked, /苏晴[^\n]*红裙/);
  assert.match(locked, /参考图只用于锁定脸型、五官、发型、年龄和体型/);
  assert.match(locked, /忽略参考图中的米白色针织开衫搭配浅色长裙/);
});

test('professional first/key/last frame prompt generators treat continuity wardrobe as authoritative', () => {
  const cfg = { language: 'zh', style: { default_image_ratio: '9:16' } };
  for (const prompt of [
    promptI18n.getFirstFramePrompt(cfg),
    promptI18n.getKeyFramePrompt(cfg),
    promptI18n.getLastFramePrompt(cfg),
  ]) {
    assert.match(prompt, /服装连戏铁律/);
    assert.match(prompt, /高于参考图服装/);
  }
});

test('audio-only role is removed from both fresh and cached wardrobe locks', () => {
 const db = createDb();
 db.prepare("UPDATE storyboards SET action=?, result=?, image_prompt='', video_prompt='' WHERE id=53")
   .run('林晚冲进消防通道。','苏晴追来的脚步声从身后传来。');
 continuity.auditEpisodeContinuity(db,5,{apply:true});
 const snapshot=JSON.parse(db.prepare('SELECT continuity_snapshot FROM storyboards WHERE id=53').get().continuity_snapshot);
 assert.ok(snapshot.characters['林晚']);
 assert.equal(snapshot.characters['苏晴'],undefined);
 const prompt=continuity.applyStoryboardContinuityLock(db,53,'林晚打电话。\n【人物服装连戏最高优先级】\n- 苏晴：错误的旧锁');
 assert.ok(prompt.includes('林晚'));
 assert.ok(!prompt.includes('苏晴'));
 db.close();
});
