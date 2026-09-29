const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events'),http=require('node:http');
const Database=require('better-sqlite3');
const {runMigrationsAndEnsure}=require('../src/db/migrate');
const ai=require('../src/services/aiClient'),config=require('../src/services/aiConfigService');
const log={info(){},warn(){},error(){}};
test('vision request carries labeled target plus references, and keeps single-image callers compatible',async()=>{
 const db=new Database(':memory:');runMigrationsAndEnsure(db);const original=http.request;let captured;
 try{
 config.createConfig(db,log,{service_type:'vision_review',provider:'openai',name:'mock-vision',base_url:'http://example.invalid/v1',api_key:'test-only',model:['vision-fixture'],default_model:'vision-fixture'});
 http.request=(_options,callback)=>{const request=new EventEmitter();request.write=body=>{captured=JSON.parse(body);};request.end=()=>queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=200;callback(res);res.emit('data',Buffer.from(JSON.stringify({choices:[{message:{content:'{"decision":"UNCERTAIN"}'}}]})));res.emit('end');request.emit('close');});return request;};
 const sources=[{label:'target',imageUrl:'data:image/png;base64,AA=='},{label:'character reference',imageUrl:'data:image/png;base64,BB=='}];
 await ai.generateTextWithVision(db,log,'vision_review','contract','system',sources,{require_service_config:true});
 const content=captured.messages.at(-1).content;assert.equal(content.filter(c=>c.type==='image_url').length,2);assert.deepEqual(content.filter(c=>c.type==='text').map(c=>c.text),['contract','target','character reference']);assert.equal(captured.model,'vision-fixture');
 await ai.generateTextWithVision(db,log,'vision_review','contract','system',sources[0]);assert.equal(captured.messages.at(-1).content.filter(c=>c.type==='image_url').length,1);
 }finally{http.request=original;db.close();}
});
test('dedicated vision config never silently falls back to text',async()=>{
 const db=new Database(':memory:');runMigrationsAndEnsure(db);try{config.createConfig(db,log,{service_type:'text',provider:'openai',name:'text-only',base_url:'http://example.invalid',api_key:'test-only',model:['text-model']});await assert.rejects(ai.generateTextWithVision(db,log,'vision_review','x','x',{imageUrl:'data:image/png;base64,AA=='},{require_service_config:true}),/未配置/);}finally{db.close();}
});
