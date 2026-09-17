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
