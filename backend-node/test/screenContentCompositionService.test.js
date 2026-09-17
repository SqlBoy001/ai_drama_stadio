const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const {
  detectScreenContentComposition,
  applyScreenContentComposition,
  auditEpisodeScreenComposition,
} = require('../src/services/screenContentCompositionService');

const reactionShot = {
  title: '手机异变弹幕',
  action: "林晚看向突然亮起的手机，直播界面弹幕刷过：'别进电梯！''回头！快回头！'，她手指僵住，瞳孔收缩。",
  result: '林晚僵在原地，手机弹幕仍在滚动。',
  shot_type: '特写',
};

test('detects a shot that must show both a face reaction and plot-critical phone content', () => {
  const result = detectScreenContentComposition(reactionShot);
  assert.equal(result.required, true);
  assert.deepEqual(result.screenTexts, ['别进电梯！', '回头！快回头！']);
});

test('adds a side UI overlay and forbids glowing phone backs for image and video prompts', () => {
  const imagePrompt = applyScreenContentComposition('正面特写，手机冷光照亮林晚的脸。', reactionShot, 'image');
  const videoPrompt = applyScreenContentComposition('镜头推近林晚和她手中的手机。', reactionShot, 'video');

  for (const prompt of [imagePrompt, videoPrompt]) {
    assert.match(prompt, /手机信息双层构图最高优先级/);
    assert.match(prompt, /侧边负空间/);
    assert.match(prompt, /独立手机界面UI浮层/);
    assert.match(prompt, /别进电梯！/);
    assert.match(prompt, /手机背壳必须完全不发光/);
    assert.match(prompt, /禁止把屏幕内容画在手机背壳/);
  }
  assert.match(videoPrompt, /浮层固定在画面坐标/);
});

test('does not add an overlay to an ordinary phone shot without visible story information', () => {
  const shot = { action: '林晚把手机放进口袋，转身走向电梯。', result: '她离开走廊。' };
  const prompt = '中景，林晚收起手机。';
  assert.equal(applyScreenContentComposition(prompt, shot, 'image'), prompt);
});

test('composition injection is idempotent', () => {
  const once = applyScreenContentComposition('正面特写。', reactionShot, 'video');
  const twice = applyScreenContentComposition(once, reactionShot, 'video');
  assert.equal(twice, once);
});

test('episode audit updates stored prompts and marks old image/video generations for local regeneration', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE episodes (id INTEGER PRIMARY KEY, deleted_at TEXT);
    CREATE TABLE storyboards (
      id INTEGER PRIMARY KEY, episode_id INTEGER, storyboard_number INTEGER,
      title TEXT, description TEXT, action TEXT, result TEXT, atmosphere TEXT, dialogue TEXT,
      shot_type TEXT, image_prompt TEXT, polished_prompt TEXT, video_prompt TEXT,
      image_url TEXT, local_path TEXT, video_url TEXT, updated_at TEXT, deleted_at TEXT
    );
    CREATE TABLE image_generations (
      id INTEGER PRIMARY KEY, storyboard_id INTEGER, prompt TEXT, status TEXT, deleted_at TEXT
    );
    CREATE TABLE video_generations (
      id INTEGER PRIMARY KEY, storyboard_id INTEGER, prompt TEXT, status TEXT, deleted_at TEXT
    );
    INSERT INTO episodes (id) VALUES (1);
    INSERT INTO storyboards
      (id, episode_id, storyboard_number, title, action, result, shot_type, image_prompt, polished_prompt, video_prompt)
      VALUES (9, 1, 2, '手机异变弹幕',
        '林晚看向手机直播界面，弹幕刷过：“别进电梯！”，她瞳孔收缩。',
        '手机弹幕滚动，林晚僵住。', '特写', '旧图片提示词', '旧优化提示词', '旧视频提示词');
    INSERT INTO image_generations (id, storyboard_id, prompt, status) VALUES (1, 9, '旧图片提示词', 'completed');
    INSERT INTO video_generations (id, storyboard_id, prompt, status) VALUES (1, 9, '旧视频提示词', 'completed');
  `);

  const result = auditEpisodeScreenComposition(db, 1, { apply: true });
  const updated = db.prepare('SELECT image_prompt, polished_prompt, video_prompt FROM storyboards WHERE id = 9').get();
  assert.deepEqual(result.regenerate_storyboard_numbers, [2]);
  assert.deepEqual(result.regenerate_video_storyboard_numbers, [2]);
  assert.match(updated.image_prompt, /手机信息双层构图最高优先级/);
  assert.match(updated.polished_prompt, /手机背壳必须完全不发光/);
  assert.match(updated.video_prompt, /浮层固定在画面坐标/);
  db.close();
});
