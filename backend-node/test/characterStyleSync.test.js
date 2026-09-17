'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runMigrationsAndEnsure } = require('../src/db/migrate');
const dramaService = require('../src/services/dramaService');
const promptI18n = require('../src/services/promptI18n');
const {
  characterPromptMatchesStyle,
  stripRenderStyleFromAppearance,
} = require('../src/services/characterLibraryService');

const silentLog = { info() {}, warn() {}, error() {}, errorw() {} };

test('appearance cleanup removes render style wording but preserves identity facts', () => {
  const text = '女性，二十岁出头，黑色长直发，浅灰色卫衣，符合2.5D国漫风格。';
  assert.equal(stripRenderStyleFromAppearance(text), '女性，二十岁出头，黑色长直发，浅灰色卫衣。');
  assert.equal(
    stripRenderStyleFromAppearance('女性，浅棕色长卷发，贴合2.5D国漫风格。'),
    '女性，浅棕色长卷发。',
  );
});

test('changing drama style clears stale character prompt and cleans appearance without removing image', () => {
  const db = new Database(':memory:');
  runMigrationsAndEnsure(db);
  try {
    const drama = dramaService.createDrama(db, silentLog, {
      title: '样例',
      style: '2.5D国漫',
      metadata: { style_prompt_zh: '2.5D国漫', style_prompt_en: '2.5D Chinese animation' },
    });
    const now = new Date().toISOString();
    const char = db.prepare(
      `INSERT INTO characters
       (drama_id, name, appearance, polished_prompt, image_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      drama.id,
      '林晚',
      '女性，黑色长直发，浅灰卫衣，符合2.5D国漫风格。',
      '【画风·最高优先级】四格统一：2.5D国漫',
      'https://example.test/linwan.png',
      now,
      now,
    );
    const episode = db.prepare(
      `INSERT INTO episodes (drama_id, episode_number, title, created_at, updated_at)
       VALUES (?, 1, '第一集', ?, ?)`,
    ).run(drama.id, now, now);
    const scene = db.prepare(
      `INSERT INTO scenes
       (drama_id, episode_id, location, prompt, polished_prompt, polished_prompt_single, created_at, updated_at)
       VALUES (?, ?, '走廊', '2.5D国漫，深夜走廊', '旧四视图提示词', '旧单图提示词', ?, ?)`,
    ).run(drama.id, episode.lastInsertRowid, now, now);
    const storyboard = db.prepare(
      `INSERT INTO storyboards
       (episode_id, storyboard_number, image_prompt, video_prompt, polished_prompt, created_at, updated_at)
       VALUES (?, 1, '近景，2.5D国漫', '推镜，2.5D Chinese animation', '旧润色提示词', ?, ?)`,
    ).run(episode.lastInsertRowid, now, now);

    dramaService.saveOutline(db, silentLog, drama.id, { style: 'urban suspense cinematic' });

    const row = db.prepare(
      'SELECT appearance, polished_prompt, image_url FROM characters WHERE id = ?',
    ).get(char.lastInsertRowid);
    assert.equal(row.appearance, '女性，黑色长直发，浅灰卫衣。');
    assert.equal(row.polished_prompt, null);
    assert.equal(row.image_url, 'https://example.test/linwan.png');
    const sceneRow = db.prepare(
      'SELECT prompt, polished_prompt, polished_prompt_single FROM scenes WHERE id = ?',
    ).get(scene.lastInsertRowid);
    assert.match(sceneRow.prompt, /写实电影级都市怪谈悬疑/);
    assert.equal(sceneRow.polished_prompt, null);
    assert.equal(sceneRow.polished_prompt_single, null);
    const storyboardRow = db.prepare(
      'SELECT image_prompt, video_prompt, polished_prompt FROM storyboards WHERE id = ?',
    ).get(storyboard.lastInsertRowid);
    assert.match(storyboardRow.image_prompt, /写实电影级都市怪谈悬疑/);
    assert.match(storyboardRow.video_prompt, /photorealistic cinematic urban folklore psychological suspense/);
    assert.equal(storyboardRow.polished_prompt, null);
  } finally {
    db.close();
  }
});

test('cached character prompt is reusable only when it contains the active style', () => {
  const cfg = {
    style: {
      default_style_zh: '写实电影级都市怪谈悬疑',
      default_style_en: 'photorealistic cinematic urban folklore suspense',
    },
  };
  assert.equal(characterPromptMatchesStyle('画风：2.5D国漫', cfg), false);
  assert.equal(
    characterPromptMatchesStyle('画风：photorealistic cinematic urban folklore suspense', cfg),
    true,
  );
});

test('character extraction keeps appearance semantic and forbids render style phrases', () => {
  const prompt = promptI18n.getCharacterExtractionPrompt({
    app: { language: 'zh' },
    style: { default_style_zh: '写实电影级都市怪谈悬疑' },
  });
  assert.match(prompt, /appearance.*不要写入画风|不要写入.*风格/s);
  assert.match(prompt, /画风.*由系统在生图时统一注入/s);
});
