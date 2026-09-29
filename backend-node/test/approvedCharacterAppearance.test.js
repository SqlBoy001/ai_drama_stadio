const test=require('node:test'),assert=require('node:assert/strict');
const {approvedAppearance}=require('../src/services/characterGenerationService');
test('approved yellow costume and short hair survive contradictory extraction',()=>{
 const confirmed=[{name:'林夏',visual_anchor:'24岁，短黑发，芥末黄卫衣，深灰长裤'}];
 assert.equal(approvedAppearance({name:'林夏',appearance:'长发灰色上衣'},confirmed),confirmed[0].visual_anchor);
 assert.equal(approvedAppearance({name:'旁人',appearance:'蓝色上衣'},confirmed),'蓝色上衣');
 assert.equal(approvedAppearance({name:'林夏',appearance:'新描述'},[{name:'林夏',appearance_lock:'固定锁',visual_anchor:'旧摘要'}]),'固定锁');
});
