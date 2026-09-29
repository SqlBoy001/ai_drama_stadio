const test=require('node:test'),assert=require('node:assert/strict');
const service=require('../src/services/characterDraftService');
const draft={era:'古代公主',body:'13岁少女',face:'清秀',hair:'黑发',costume:'淡青交领',material:'棉布磨损',expression:'沉静',negative:'无现代军装',description:'【背景】亡国公主'};
test('one structured design produces aligned appearance and image prompt',()=>{const r=service.formatDraft(draft,'三维国漫');assert.ok(r.polished_prompt.includes(r.appearance));assert.ok(r.appearance.includes('【脸型与五官】\n清秀'));assert.equal(r.description,draft.description);assert.equal(r.negative_prompt,draft.negative);assert.throws(()=>service.formatDraft({...draft,hair:''},''),/hair/);});
test('AI draft reads live inputs and story but does not persist until user saves',async()=>{
 const DB=require('better-sqlite3'),db=new DB(':memory:'),ai=require('../src/services/aiClient'),original=ai.generateText;
 try{require('../src/db/migrate').runMigrationsAndEnsure(db);db.prepare("INSERT INTO dramas(id,title,style) VALUES(1,'古代故事','国漫')").run();db.prepare("INSERT INTO characters(id,drama_id,name,appearance) VALUES(1,1,'姜瑾','旧外貌')").run();db.prepare("INSERT INTO episodes(drama_id,episode_number,script_content) VALUES(1,1,'公主被押送')").run();
 ai.generateText=async(_db,_log,_type,user)=>{const p=JSON.parse(user);assert.equal(p.current.appearance,'新输入');assert.match(p.scripts,/公主被押送/);return JSON.stringify(draft)};
 const out=await service.generate(db,{},1,{instruction:'更清秀',appearance:'新输入'});assert.match(out.appearance,/淡青交领/);assert.equal(db.prepare('SELECT appearance FROM characters WHERE id=1').get().appearance,'旧外貌');
 ai.generateText=async()=>'{bad';await assert.rejects(service.generate(db,{},1,{instruction:'修改'}),/格式无效/);
 }finally{ai.generateText=original;db.close()}
});
