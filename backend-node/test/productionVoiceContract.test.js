const test = require('node:test');
const assert = require('node:assert/strict');
const {audioJobs, referenceVoice, assertShot} = require('../src/services/productionVoiceContract');
const cast = [{id:1,name:'林夏',tts_voice_id:'girl',tts_provider:'minimax'},{id:2,name:'母亲',tts_voice_id:'aunt',tts_provider:'minimax'}];
const cfg = {provider:'minimax',settings:JSON.stringify({voice_id:'narrator'})};
test('named offscreen speaker selects own voice, narration remains separate',()=>{
 const jobs=audioJobs({characters:'[1]',dialogue:'母亲：开门。',narration:'门外传来声音。'},cast,cfg);
 assert.deepEqual(jobs.map(x=>[x.text,x.voice_id]),[['开门。','aunt'],['门外传来声音。','narrator']]);
});
test('ambiguous or multiple speakers and wrong provider fail before synthesis',()=>{
 for(const dialogue of ['开门。','林夏：谁？\n母亲：我。','陌生人：你好']) assert.throws(()=>audioJobs({characters:'[1,2]',dialogue},cast,cfg));
 assert.throws(()=>audioJobs({characters:'[1]',dialogue:'你好'},cast,{provider:'openai'}));
});
test('reference voice never falls back to unrelated first character',()=>{
 const refs=new Map([[1,'girl.wav']]);
 assert.throws(()=>referenceVoice({dialogue:'母亲：开门',characters:'[1]'},cast,refs));
 assert.equal(referenceVoice({dialogue:'',characters:'[1]'},cast,refs),null);
 assert.equal(referenceVoice({dialogue:'林夏：谁'},cast,refs),'girl.wav');
});
test('shot preflight describes missing dimensions',()=>{
 assert.throws(()=>assertShot({id:3,duration:5,action:'转动'}),/景别.*动作结果.*光影/);
 assert.doesNotThrow(()=>assertShot({duration:5,shot_type:'特写',angle:'平视',movement:'固定',location:'门口',action:'旋转',result:'水平',lighting_style:'soft'}));
});
test('character voice settings persist and reject malformed input',()=>{
 const db=new (require('better-sqlite3'))(':memory:');
 try {
 require('../src/db/migrate').runMigrationsAndEnsure(db);
 db.prepare("INSERT INTO dramas(id,title) VALUES(1,'测试')").run();
 db.prepare("INSERT INTO characters(id,drama_id,name) VALUES(1,1,'林夏')").run();
 const svc=require('../src/services/characterLibraryService'),log={info(){}};
 assert.equal(svc.updateCharacter(db,log,1,{tts_provider:'minimax',tts_voice_id:'girl'}).ok,true);
 assert.equal(db.prepare('SELECT tts_voice_id FROM characters WHERE id=1').get().tts_voice_id,'girl');
 assert.equal(svc.updateCharacter(db,log,1,{tts_voice_id:{bad:true}}).ok,false);
 assert.equal(db.prepare('SELECT tts_voice_id FROM characters WHERE id=1').get().tts_voice_id,'girl');
 } finally {db.close();}
});
