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

test('production service preserves first frame when reference list is also populated', async () => {
  const db = new Database(':memory:');
  runMigrationsAndEnsure(db);
  aiConfigService.createConfig(db, silentLog, {
    service_type: 'video', provider: 'volces', name: 'Regression',
    base_url: 'https://example.invalid/api/v3', api_key: 'test-key',
    api_protocol: 'volcengine', endpoint: '/contents/generations/tasks',
    model: ['doubao-seedance-2-5-260628'], default_model: 'doubao-seedance-2-5-260628', is_default: true,
  });
  const frame = 'data:image/jpeg;base64,/9j/2Q==';
  db.prepare(`INSERT INTO video_generations (drama_id, prompt, model, status, image_url, first_frame_url, reference_image_urls)
    VALUES (1, '两位男性在会议室递方案', 'doubao-seedance-2-5-260628', 'pending', ?, ?, ?)`)
    .run(frame, frame, JSON.stringify([frame]));
  const originalFetch = global.fetch;
  let body;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    // Stop at submission: never launch a poll or download in this regression.
    return { ok: false, status: 400, text: async () => '{"error":{"message":"test stop"}}' };
  };
  try {
    await require('../src/services/videoService').processVideoGeneration(db, silentLog, 1);
    assert.equal(body?.task_type, 'i2v');
    assert.equal(body.content.find(item => item.role === 'first_frame')?.image_url.url, frame);
  } finally { global.fetch = originalFetch; db.close(); }
});

test('classic protocol blocks unsupported reference-only and missing local-frame requests before network', async () => {
  const db = new Database(':memory:');
  runMigrationsAndEnsure(db);
  aiConfigService.createConfig(db,silentLog,{
    service_type:'video',provider:'volces',name:'guard',base_url:'https://example.invalid/api/v3',api_key:'test-key',
    api_protocol:'volcengine',endpoint:'/contents/generations/tasks',model:['doubao-seedance-2-5-260628'],is_default:true,
  });
  const originalFetch=global.fetch;
  let calls=0;
  global.fetch=async()=>{calls++; throw new Error('network must not run');};
  try {
    const result=await callVideoApi(db,silentLog,{prompt:'test',model:'doubao-seedance-2-5-260628',reference_urls:['https://example.invalid/image.jpg']});
    assert.match(result.error,/不能.*降级/);
    await assert.rejects(callVideoApi(db,silentLog,{prompt:'test',model:'doubao-seedance-2-5-260628',first_frame_url:'http://localhost:5679/static/missing.jpg',storage_local_path:'/tmp/nonexistent-drama-frames'}),/无法读取/);
    assert.equal(calls,0);
  } finally {global.fetch=originalFetch;db.close();}
});

test('local encoded Chinese frame path is embedded in the actual provider body', async () => {
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'drama-frame-'));
 const filename='会议室 首帧.jpg';
 fs.writeFileSync(path.join(root,filename),Buffer.from([255,216,255,217]));
 const db=new Database(':memory:'); runMigrationsAndEnsure(db);
 aiConfigService.createConfig(db,silentLog,{service_type:'video',provider:'volces',name:'local frame',base_url:'https://example.invalid/api/v3',api_key:'test-key',api_protocol:'volcengine',endpoint:'/contents/generations/tasks',model:['doubao-seedance-2-5-260628'],is_default:true});
 const originalFetch=global.fetch;let body;
 global.fetch=async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,status:200,text:async()=>'{"id":"test-only","status":"queued"}'};};
 try {
  await callVideoApi(db,silentLog,{prompt:'same office',model:'doubao-seedance-2-5-260628',first_frame_url:'http://localhost:5679/static/'+encodeURIComponent(filename),storage_local_path:root});
  assert.equal(body.task_type,'i2v');
  assert.equal(body.content.find(x=>x.role==='first_frame').image_url.url,'data:image/jpeg;base64,/9j/2Q==');
 } finally {global.fetch=originalFetch;db.close();fs.rmSync(root,{recursive:true,force:true});}
});
