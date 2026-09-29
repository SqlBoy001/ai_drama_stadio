const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { syncStoryboardCharacters } = require('../src/services/imageService');

test('offscreen mentions and negative prompts never add reference characters', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE episodes(id INTEGER, drama_id INTEGER, deleted_at TEXT);
    CREATE TABLE characters(id INTEGER, drama_id INTEGER, name TEXT, deleted_at TEXT);
    CREATE TABLE storyboards(id INTEGER, episode_id INTEGER, characters TEXT, action TEXT,
      dialogue TEXT, result TEXT, description TEXT, deleted_at TEXT, updated_at TEXT);
    INSERT INTO episodes VALUES(1,1,NULL);
    INSERT INTO characters VALUES(1,1,'李默',NULL),(2,1,'主管',NULL),(3,2,'客户',NULL);`);
  const log = { warn() {} };
  try {
    for (const [cast, action, dialogue, description] of [
      ['[1]', '只有李默拨电话，主管不出镜', '', '他绕开主管联系客户'],
      ['[1]', '李默独自站着', '李默：主管为什么拦我？', ''],
      ['[]', '空办公室', '', '主管已经离开'],
      ['[{"id":1,"name":"李默"},{"id":2,"name":"主管"}]', '李默与主管对视', '', ''],
    ]) {
      db.prepare('DELETE FROM storyboards').run();
      db.prepare('INSERT INTO storyboards VALUES(1,1,?,?,?,?,?,NULL,NULL)').run(cast, action, dialogue, '完成', description);
      const result = syncStoryboardCharacters(db, log, 1);
      assert.deepEqual(result.added, []);
      assert.equal(db.prepare('SELECT characters FROM storyboards').get().characters, cast);
      assert.ok(!result.mentioned.includes('客户'), 'must not cross project boundaries');
    }
  } finally { db.close(); }
});
