const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const http = require('node:http');
const Database = require('better-sqlite3');
const { runMigrationsAndEnsure } = require('../src/db/migrate');
const aiConfigService = require('../src/services/aiConfigService');
const storyGenerationService = require('../src/services/storyGenerationService');

const silentLog = { info() {}, warn() {}, error() {}, errorw() {} };

test('structured story generation disables DeepSeek thinking so final content is not starved', async () => {
  const db = new Database(':memory:');
  runMigrationsAndEnsure(db);
  aiConfigService.createConfig(db, silentLog, {
    service_type: 'text',
    provider: 'deepseek',
    name: 'DeepSeek reasoning test',
    base_url: 'http://deepseek.test/v1',
    api_key: 'test-key',
    model: ['deepseek-v4-pro'],
    default_model: 'deepseek-v4-pro',
    settings: JSON.stringify({ deepseek_thinking: 'enabled', deepseek_reasoning_effort: 'high' }),
    is_default: true,
  });

  const originalRequest = http.request;
  let requestBody = null;
  http.request = (_options, callback) => {
    const req = new EventEmitter();
    let raw = '';
    req.write = (chunk) => { raw += chunk; };
    req.destroy = () => req.emit('error', new Error('destroyed'));
    req.end = () => {
      process.nextTick(() => {
        requestBody = JSON.parse(raw);
        const res = new EventEmitter();
        res.statusCode = 200;
        callback(res);
        process.nextTick(() => {
          const content = JSON.stringify([{ episode: 1, title: '测试集', content: '完整剧本正文' }]);
          const delta = requestBody.thinking?.type === 'disabled'
            ? { content }
            : { reasoning_content: '长思考占满了输出额度', content: '' };
          res.emit('data', Buffer.from(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`));
          res.emit('end');
        });
      });
    };
    return req;
  };

  try {
    const result = await storyGenerationService.generateStory(db, silentLog, {
      premise: '一个最小测试故事',
      episode_count: 1,
      episode_duration_seconds: 30,
    });
    assert.equal(requestBody.thinking?.type, 'disabled');
    assert.match(requestBody.messages[0].content, /30 秒/);
    assert.match(requestBody.messages[0].content, /前三秒/);
    assert.doesNotMatch(requestBody.messages[0].content, /约 800 字/);
    assert.equal(result.episodes[0].content, '完整剧本正文');
  } finally {
    http.request = originalRequest;
    db.close();
  }
});
