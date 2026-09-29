const test=require('node:test'),assert=require('node:assert/strict'),DB=require('better-sqlite3');
test('character edit replaces snapshot locks preserving action; old media detached and history retained',()=>{
 const db=new DB(':memory:');try{require('../src/db/migrate').runMigrationsAndEnsure(db);db.prepare("INSERT INTO dramas(id,title)VALUES(1,'测试')").run();db.prepare('INSERT INTO episodes(id,drama_id)VALUES(1,1)').run();db.prepare("INSERT INTO characters(id,drama_id,name,appearance)VALUES(1,1,'姜瑾','旧裙')").run();db.prepare(`INSERT INTO storyboards(id,episode_id,characters,image_prompt,video_prompt,action,local_path,continuity_snapshot)VALUES(1,1,'[1]','姜瑾旧裙','旧裙触碰自己的脚镣','触碰自己的脚镣','old.png',?)`).run(JSON.stringify({characters:[{name:'姜瑾',appearance_lock:'旧裙'}]}));
 const svc=require('../src/services/characterLibraryService');svc.updateCharacter(db,{info(){}},1,{appearance:'新裙'});
 const s=db.prepare('SELECT * FROM storyboards WHERE id=1').get();assert.equal(s.image_prompt,'姜瑾新裙');assert.equal(s.action,'触碰自己的脚镣');assert.equal(s.local_path,null);assert.equal(JSON.parse(s.character_dependency_state).previous_media[0].local_path,'old.png');require('../src/services/characterDependencyService').assertCurrent(db,1);assert.throws(()=>require('../src/services/characterDependencyService').assertCurrent(db,1,true),/新版分镜图/);
 }finally{db.close()}
});
