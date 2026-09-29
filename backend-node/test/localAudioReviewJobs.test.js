const test=require('node:test'),assert=require('node:assert/strict');
const {contract}=require('../src/services/localAudioReviewJobs');
const h={dialogue_cues:[{shot_id:3,dialogue:'对白',narration:'旁白'}]},m=[{source_id:'narration_audio_local_path:3',asset_id:'1234567890-abcdef'}];
const t={fps:30,tracks:[{id:'track',muted:false}],items:[{item:{id:'voice',type:'audio',assetId:'1234567890',trackId:'track',startFrame:300,durationFrames:60,sourceIn:0}}]};
test('expected speech uses edited audio position, not original storyboard ordinal',()=>{
 const c=contract(h,t,m);assert.equal(c.expected[0].start,10);assert.equal(c.expected[0].end,12);assert.equal(c.expected[0].text,'旁白');assert.equal(c.gaps.length,0);
});
test('trimmed or muted voices cannot silently inherit complete original text',()=>{
 let v=structuredClone(t);v.items[0].item.sourceIn=500000;
 assert.equal(contract(h,v,m).expected.length,0);assert.match(contract(h,v,m).gaps[0],/裁切/);
 v=structuredClone(t);v.tracks[0].muted=true;assert.equal(contract(h,v,m).expected.length,0);
});
test('restart marks unfinished tasks interrupted without starting them',()=>{
 const DB=require('better-sqlite3'),fs=require('node:fs'),path=require('node:path');const db=new DB(':memory:');
 try {
  db.exec(fs.readFileSync(path.join(__dirname,'../migrations/30_local_audio_reviews.sql'),'utf8'));
  db.prepare("INSERT INTO local_audio_reviews VALUES('one','job','sha','timeline','RUNNING','{}',NULL,NULL,'now','now')").run();
  require('../src/services/localAudioReviewJobs').recover(db);
  assert.equal(db.prepare('SELECT status FROM local_audio_reviews').get().status,'INTERRUPTED');
 }finally{db.close();}
});
