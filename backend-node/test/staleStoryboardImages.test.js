const test = require('node:test');
const assert = require('node:assert/strict');
const DB = require('better-sqlite3');
test('invalidated storyboard images cannot become current through history fallback', () => {
 const db = new DB(':memory:');
 try {
 require('../src/db/migrate').runMigrationsAndEnsure(db);
 db.prepare("INSERT INTO dramas(id,title) VALUES(1,'test')").run();
 db.prepare('INSERT INTO episodes(id,drama_id) VALUES(1,1)').run();
 db.prepare('INSERT INTO storyboards(id,episode_id,character_dependency_state) VALUES(1,1,?)').run(JSON.stringify({invalidated_at:'2026-09-28T00:00:00.000Z'}));
 for (const [id,date] of [[1,'2026-09-27T00:00:00.000Z'],[2,'2026-09-28T01:00:00.000Z']]) db.prepare("INSERT INTO image_generations(id,drama_id,storyboard_id,status,local_path,created_at) VALUES(?,1,1,'completed','test.png',?)").run(id,date);
 const svc=require('../src/services/imageService');
 assert.deepEqual(svc.list(db,{storyboard_id:1}).items.map(x=>x.id),[2]);
 assert.equal(svc.list(db,{storyboard_id:1,include_stale:'true'}).items.length,2);
 assert.ok(svc.getById(db,1));
 } finally {db.close();}
});
