const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runMigrationsAndEnsure } = require('../src/db/migrate');
const aiConfigService = require('../src/services/aiConfigService');
const { callVideoApi } = require('../src/services/videoClient');

const silentLog = { info() {}, warn() {}, error() {}, errorw() {} };

test('Seedance first-frame requests omit ratio because the image determines output ratio', async () => {
  const db = new Database(':memory:');
  runMigrationsAndEnsure(db);
  aiConfigService.createConfig(db, silentLog, {
    service_type: 'video',
    provider: 'volces',
    name: 'Seedance',
    base_url: 'https://ark.cn-beijing.volces.com/api/v3',
    api_key: 'test-key',
    api_protocol: 'volcengine',
    endpoint: '/contents/generations/tasks',
    model: ['doubao-seedance-1-5-pro-251215'],
    default_model: 'doubao-seedance-1-5-pro-251215',
    is_default: true,
  });

  const originalFetch = global.fetch;
  let submittedBody;
  global.fetch = async (_url, options) => {
    submittedBody = JSON.parse(options.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'task-ok', status: 'queued' }) };
  };
  try {
    const result = await callVideoApi(db, silentLog, {
      prompt: '午夜便利店，镜头缓慢推进',
      model: 'doubao-seedance-1-5-pro-251215',
      duration: 5,
      aspect_ratio: '9:16',
      resolution: '720p',
      first_frame_url: 'data:image/jpeg;base64,/9j/2Q==',
      video_gen_id: 1,
    });
    assert.equal(result.task_id, 'task-ok');
    assert.equal(submittedBody.task_type, 'i2v');
    assert.equal(Object.hasOwn(submittedBody, 'ratio'), false);
    assert.equal(Object.hasOwn(submittedBody, 'aspect_ratio'), false);
  } finally {
    global.fetch = originalFetch;
    db.close();
  }
});
