const test = require('node:test');
const assert = require('node:assert/strict');
const promptI18n = require('../src/services/promptI18n');
const sceneService = require('../src/services/sceneService');

test('scene prompts require a restrained story-relevant anomaly for suspense art direction', () => {
  const cfg = {
    app: { language: 'zh' },
    style: {
      default_style_zh: '写实二次元都市怪谈，心理悬疑',
      default_image_ratio: '9:16',
    },
  };
  const extraction = promptI18n.getSceneExtractionPrompt(cfg);
  const single = promptI18n.getScenePolishPromptSingle(cfg);
  const fourView = promptI18n.getScenePolishPrompt(cfg);
  for (const prompt of [extraction, single, fourView]) {
    assert.match(prompt, /叙事异常点/);
    assert.match(prompt, /剧情/);
    assert.match(prompt, /蜘蛛网|血迹|雾气/);
  }
});

test('scene prompt cache is invalidated when the project art direction changes', () => {
  const cfg = {
    style: {
      default_style_zh: '新的写实二次元都市怪谈画风',
      default_style_en: 'new realistic anime suspense style',
    },
  };
  assert.equal(sceneService.scenePromptMatchesStyle('【画风·最高优先级】四格统一：2.5D国漫', cfg), false);
  assert.equal(sceneService.scenePromptMatchesStyle('【画风·最高优先级】新的写实二次元都市怪谈画风', cfg), true);
});
