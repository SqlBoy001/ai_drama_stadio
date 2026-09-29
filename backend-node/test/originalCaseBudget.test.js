const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {reserve}=require('../../scripts/original-case-budget.cjs');
test('real-case cap persists across calls/reload; rejected or uncertain calls are not refunded',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'case-budget-')),file=path.join(dir,'ledger.json');
 try {for(let i=0;i<6;i++)reserve(file,'video','mini',3);assert.equal(reserve(file,'image','seedream',.25),18.25);
 assert.throws(()=>reserve(file,'video','mini',3),/20元/);assert.equal(JSON.parse(fs.readFileSync(file)).length,7);
 assert.throws(()=>reserve(file,'text','mini',-1),/Invalid/);assert.equal(reserve(file,'text','mini',.25),18.5);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
