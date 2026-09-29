const test=require('node:test'),assert=require('node:assert/strict');
const {compare}=require('../src/services/audioTranscriptReview');
const file={sha256:'current'},transcript={media_sha256:'current',model:'local',segments:[{start:0,end:2,text:'方案，通过。',avg_logprob:-.1,no_speech_prob:0}]};
test('whole-track ASR binds exact media, compares timed lines and never declares human listening',()=>{
 const r=compare(file,transcript,[{start:0,end:5,text:'方案通过'},{start:5,end:10,text:'重新开始'}]);
 assert.equal(r.rows[0].status,'TEXT_MATCH');assert.equal(r.rows[1].status,'MISSING_AUDIO_EVIDENCE');assert.equal(r.status,'REQUIRES_CONTENT_REVIEW');
 assert.throws(()=>compare({sha256:'modified'},transcript,[{start:0,end:5,text:'方案通过'}]),/失效/);
});
test('recognition differences and low confidence remain visible',()=>{
 const r=compare(file,{...transcript,segments:[{start:0,end:2,text:'方案不通过',avg_logprob:-1}]},[{start:0,end:5,text:'方案通过'}]);
 assert.equal(r.rows[0].status,'REVIEW_DIFFERENCE');assert.equal(r.rows[0].low_confidence,true);
});
test('extra speech outside expected windows is visible and malformed timing cannot pass',()=>{
 const r=compare(file,{...transcript,segments:[...transcript.segments,{start:8,end:10,text:'额外台词'}]},[{start:0,end:5,text:'方案通过'}]);
 assert.equal(r.unmatched_segments.length,1);assert.equal(r.unmatched_segments[0].text,'额外台词');
 assert.throws(()=>compare(file,{...transcript,segments:[{start:4,end:3,text:'invalid'}]},[{start:0,end:5,text:'方案通过'}]),/范围/);
});
test('VAD silence reports every expected line as missing, not empty success',()=>{
 const r=compare(file,{...transcript,segments:[]},[{start:0,end:5,text:'方案通过'}]);
 assert.equal(r.rows.length,1);assert.equal(r.rows[0].status,'MISSING_AUDIO_EVIDENCE');assert.equal(r.status,'REQUIRES_CONTENT_REVIEW');
});
test('VAD may join adjacent lines: word sentence timing keeps both review windows',()=>{
 const merged={...transcript,segments:[{start:0,end:9,text:'方案通过。今天重来。',words:[{start:0,end:2,word:'方案通过。'},{start:5,end:8,word:'今天重来。'}]}]};
 const r=compare(file,merged,[{start:0,end:5,text:'方案通过'},{start:5,end:10,text:'今天重来'}]);
 assert.deepEqual(r.rows.map(x=>x.status),['TEXT_MATCH','TEXT_MATCH']);assert.equal(r.unmatched_segments.length,0);
});
