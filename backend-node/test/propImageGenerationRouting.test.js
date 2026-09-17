const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runMigrationsAndEnsure } = require('../src/db/migrate');
const aiConfigService = require('../src/services/aiConfigService');
const imageClient = require('../src/services/imageClient');
const propService = require('../src/services/propService');
const taskService = require('../src/services/taskService');
const propImageGenerationService = require('../src/services/propImageGenerationService');

const silentLog = { info() {}, warn() {}, error() {}, errorw() {} };

test('prop generation uses the database default image config when no model is selected', async () => {
  const db = new Database(':memory:');
  runMigrationsAndEnsure(db);
  aiConfigService.createConfig(db, silentLog, {
    service_type: 'image', provider: 'openai', name: 'Legacy OpenAI image',
    base_url: 'http://openai.invalid/v1', api_key: 'secret',
    model: ['gpt-image-2'], default_model: 'gpt-image-2', is_default: false,
  });
  aiConfigService.createConfig(db, silentLog, {
    service_type: 'image', provider: 'volcengine', name: 'Default Seedream',
    base_url: 'http://volcengine.invalid/v3', api_key: 'secret',
    model: ['doubao-seedream-4-5-251128'], default_model: 'doubao-seedream-4-5-251128', is_default: true,
  });
  const now = new Date().toISOString();
  const drama = db.prepare('INSERT INTO dramas (title, metadata, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run('道具路由测试', JSON.stringify({ aspect_ratio: '9:16' }), now, now);
  const prop = propService.create(db, silentLog, {
    drama_id: drama.lastInsertRowid,
    name: '手机',
    prompt: '一部黑色手机，纯色背景',
  });
  const task = taskService.createTask(db, silentLog, 'prop_image_generation', String(prop.id));

  const originalCallImageApi = imageClient.callImageApi;
  let capturedOptions = null;
  imageClient.callImageApi = async (_db, _log, options) => {
    capturedOptions = options;
    return { error: 'test stopped after routing' };
  };

  try {
    await propImageGenerationService.processPropImageGeneration(db, silentLog, task.id, prop.id, {});
    assert.equal(capturedOptions.preferred_provider, undefined);
    const selected = imageClient.getDefaultImageConfig(
      db,
      capturedOptions.model,
      capturedOptions.preferred_provider,
      'image'
    );
    assert.equal(selected.provider, 'volcengine');
    assert.equal(selected.default_model, 'doubao-seedream-4-5-251128');

    const explicitTask = taskService.createTask(db, silentLog, 'prop_image_generation', String(prop.id));
    capturedOptions = null;
    await propImageGenerationService.processPropImageGeneration(
      db,
      silentLog,
      explicitTask.id,
      prop.id,
      { model: 'gpt-image-2' }
    );
    assert.equal(capturedOptions.model, 'gpt-image-2');
    const explicitSelection = imageClient.getDefaultImageConfig(
      db,
      capturedOptions.model,
      capturedOptions.preferred_provider,
      'image'
    );
    assert.equal(explicitSelection.provider, 'openai');
  } finally {
    imageClient.callImageApi = originalCallImageApi;
    db.close();
  }
});
