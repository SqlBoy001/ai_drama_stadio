const test=require('node:test'),assert=require('node:assert/strict');
const {capture}=require('../src/services/chatcutLayerEvidence');
const item={item:{id:'caption1',type:'motion-graphic',assetId:'template1'},attachedEffects:[],transitions:[]};
test('shared template code and defaults invalidate evidence independently of item text',async()=>{
 let code='<div>A</div>',color='white';
 const execute=async()=>({asset:{id:'template1',type:'motion-graphic',html:code,properties:[{key:'color',defaultValue:color}]}});
 const a=await capture([item],execute);code='<div>B</div>';const b=await capture([item],execute);
 assert.equal(a.complete,true);assert.notEqual(a.assets[0].source_sha256,b.assets[0].source_sha256);
 color='black';const c=await capture([item],execute);assert.notDeepEqual(b,c);
});
test('Desktop empty MG html is incomplete, never metadata-only PASS',async()=>{
 const r=await capture([item],async()=>({asset:{id:'template1',type:'motion-graphic',html:''}}));
 assert.equal(r.complete,false);assert.equal(r.assets[0].source_sha256,null);
});
test('effects are read once, unknown references and caption pagination fail closed',async()=>{
 const calls=[];const r=await capture([{...item,attachedEffects:[{assetId:'fx'},{assetId:'fx'}],transitions:[{id:'unknown'}]}],async(name,args)=>{
 calls.push({name,args});return name==='read_captions'?{cards:[]}:{asset:{id:args.assetId,type:args.assetId==='fx'?'effect':'motion-graphic',code:'source'}};
 },true);
 assert.equal(calls.filter(c=>c.args.assetId==='fx').length,1);
 assert.equal(calls.find(c=>c.args.assetId==='fx').args.includeCode,true);
 assert.equal(r.complete,false);assert.equal(r.gaps.length,2);
});
test('failed layer read is not silently skipped',async()=>{
 await assert.rejects(capture([item],async()=>{throw Error('offline')}),/offline/);
});
