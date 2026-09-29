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

test('official preset-only references use reference_image content, never empty t2v', async()=>{
 const db=new Database(':memory:');runMigrationsAndEnsure(db);
 aiConfigService.createConfig(db,silentLog,{service_type:'video',provider:'volces',name:'official',base_url:'https://example.invalid/api/v3',api_key:'test-key',api_protocol:'volcengine',endpoint:'/contents/generations/tasks',model:['doubao-seedance-2-5-260628'],is_default:true});
 const originalFetch=global.fetch;let body;
 global.fetch=async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,status:200,text:async()=>'{"id":"test-only","status":"queued"}'};};
 try{await callVideoApi(db,silentLog,{prompt:'参考图片1为主角',model:'doubao-seedance-2-5-260628',reference_urls:['asset://asset-test-official'],duration:5});assert.equal(body.content.find(x=>x.role==='reference_image').image_url.url,'asset://asset-test-official');assert.equal(body.task_type,'i2v');}finally{global.fetch=originalFetch;db.close();}
});


test('Seedance 2.5 preserves 20-second requests on the wire and retains family limits', async () => {
  const { normalizeVolcengineDuration } = require('../src/services/videoClient');
  assert.equal(normalizeVolcengineDuration('doubao-seedance-2-5-260628', 20), 20);
  assert.equal(normalizeVolcengineDuration('doubao-seedance-2-5-260628', 40), 30);
  assert.equal(normalizeVolcengineDuration('doubao-seedance-2-5-260628', 2), 4);
  assert.equal(normalizeVolcengineDuration('doubao-seedance-2-0-260128', 20), 15);
  assert.equal(normalizeVolcengineDuration('doubao-seedance-1-5-pro-251215', 20), 12);
  const db = new Database(':memory:'); runMigrationsAndEnsure(db);
  aiConfigService.createConfig(db, silentLog, {
    service_type: 'video', provider: 'volces', name: 'duration regression',
    base_url: 'https://example.invalid/api/v3', api_key: 'test-key',
    api_protocol: 'volcengine', endpoint: '/contents/generations/tasks',
    model: ['doubao-seedance-2-5-260628'], is_default: true,
  });
  const originalFetch = global.fetch; let body;
  global.fetch = async (_url, opts) => {
    body = JSON.parse(opts.body);
    return {ok: true, status: 200, text: async () => '{"id":"test-only","status":"queued"}'};
  };
  try {
    await callVideoApi(db, silentLog, {prompt: 'two people speaking', model: 'doubao-seedance-2-5-260628', duration: 20, first_frame_url: 'data:image/jpeg;base64,/9j/2Q=='});
    assert.equal(body.duration, 20);
    assert.equal(body.task_type, 'i2v');
  } finally { global.fetch = originalFetch; db.close(); }
});

test('Seedance 2.5 first-last mode omits unsupported camera_fixed but preserves other modes', async()=>{
 const db=new Database(':memory:');runMigrationsAndEnsure(db);
 aiConfigService.createConfig(db,silentLog,{service_type:'video',provider:'volces',name:'camera regression',base_url:'https://example.invalid/api/v3',api_key:'test-key',api_protocol:'volcengine',model:['doubao-seedance-2-5-260628','doubao-seedance-1-5-pro-251215'],is_default:true});
 const originalFetch=global.fetch;let body;global.fetch=async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,status:200,text:async()=>'{"id":"mock-camera","status":"queued"}'};};
 try{for(const [model,last,expected] of [['doubao-seedance-2-5-260628',true,false],['doubao-seedance-2-5-260628',false,true],['doubao-seedance-1-5-pro-251215',true,true]]){
 await callVideoApi(db,silentLog,{prompt:'固定机位',model,duration:6,camera_fixed:true,first_frame_url:'data:image/jpeg;base64,/9j/2Q==',last_frame_url:last?'data:image/png;base64,aGVsbG8=':null});assert.equal(Object.hasOwn(body,'camera_fixed'),expected);assert.equal(body.content.filter(x=>x.type==='image_url').length,last?2:1);assert.equal(body.model,model);
 }}finally{global.fetch=originalFetch;db.close();}
});
