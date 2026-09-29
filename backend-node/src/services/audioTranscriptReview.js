const evidence=require('./agentMediaEvidence');
function normalize(s) { return String(s||'').normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu,''); }
function distance(a,b) {
 let prior=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++) {const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prior[j]+1,prior[j-1]+(a[i-1]===b[j-1]?0:1));prior=next;}
 return prior[b.length];
}
function speechUnits(segments) {
 return segments.flatMap(s=>{
  if(!Array.isArray(s.words)||!s.words.length||s.words.some(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.end<w.start||typeof w.word!=='string'))return [s];
  const units=[];let words=[];
  const flush=()=>{if(words.length){units.push({...s,start:words[0].start,end:words.at(-1).end,text:words.map(w=>w.word).join(''),timing_source:'word_sentences'});words=[];}};
  for(const w of s.words){words.push(w);if(/[。！？!?]\s*$/.test(w.word))flush();}
  flush();return units.some(u=>u.end<=u.start)?[s]:units;
 });
}
function compare(file,transcript,expected) {
 if(transcript.media_sha256!==file.sha256)throw Error('转写对应的成片版本已失效');
 if(!Array.isArray(transcript.segments))throw Error('没有可核对的音轨转写');
 if(transcript.segments.length>5000 || transcript.segments.some(s=>!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start||typeof s.text!=='string'||s.text.length>10000))throw Error('转写分段或文本超出校验范围');
 if(!expected.length||expected.length>500)throw Error('缺少有界的字幕/旁白合同');
 const units=speechUnits(transcript.segments);
 const rows=expected.map(e=>{
  if(!(e.start>=0&&e.end>e.start)||!normalize(e.text))throw Error('旁白合同时间或文本无效');
  const segments=units.filter(s=>Math.min(e.end,s.end)-Math.max(e.start,s.start)>(s.end-s.start)*.5);
  const actual=segments.map(s=>s.text).join(''),a=normalize(e.text),b=normalize(actual);
  const rate=distance(a,b)/Math.max(a.length,b.length,1);
  return {...e,recognized:actual,difference_ratio:Number(rate.toFixed(3)),status:!segments.length?'MISSING_AUDIO_EVIDENCE':rate===0?'TEXT_MATCH':'REVIEW_DIFFERENCE',
    low_confidence:segments.some(s=>s.avg_logprob<-.8||s.no_speech_prob>.5),segments:segments.map(s=>({start:s.start,end:s.end}))};
 });
 return {schema_version:1,media_sha256:file.sha256,contract_digest:evidence.digest(expected),model:transcript.model,rows,
  unmatched_segments:units.filter(s=>!expected.some(e=>Math.min(e.end,s.end)-Math.max(e.start,s.start)>(s.end-s.start)*.5)),
  status:'REQUIRES_CONTENT_REVIEW',scope:'全音轨机器转写与字幕逐条核对；同音字/数字转换可能来自ASR，差异不自动改写台词，也不代表人工听审'};
}
module.exports={compare,normalize,distance};
