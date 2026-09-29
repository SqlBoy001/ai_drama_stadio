import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeQc } from '../src/utils/qcSummary.js'
test('warnings cannot be displayed as all passed', () => {
 const summary = summarizeQc([{asset_id:1,decision:'PASS'}, {asset_id:2,decision:'WARN'}])
 assert.equal(summary.label,'1/2 项基础检查通过');assert.equal(summary.issues,1)
})
test('newest attempt replaces old quality result',()=>{
 const summary=summarizeQc([{asset_id:1,decision:'WARN'},{asset_id:1,decision:'PASS'}])
 assert.equal(summary.total,1);assert.equal(summary.passed,0)
})
test('Mock and missing reports never imply verified media',()=>{
 assert.equal(summarizeQc().label,'尚未检查')
 assert.equal(summarizeQc([{asset_id:1,decision:'PASS'}],true).label,'模拟检查记录')
})
test('video file pass is displayed separately from semantic handoff and replaces obsolete shot presence checks',()=>{
 const summary=summarizeQc([{asset_type:'video',asset_id:1,decision:'HUMAN_REVIEW',checks:[{key:'decode',passed:true},{key:'duration',passed:true}]},{asset_type:'shot',asset_id:1,decision:'PASS'}]);
 assert.equal(summary.passed,0);assert.equal(summary.displayPassed,1);assert.equal(summary.total,1);assert.equal(summary.issues,1);assert.equal(summary.label,'1/1 项视频文件检查通过');
});
