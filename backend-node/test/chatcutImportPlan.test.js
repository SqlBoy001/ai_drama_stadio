const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const evidence = require('../src/services/agentMediaEvidence');
const adapter = require('../src/services/chatcutImportPlan');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatcut-plan-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // Regression: an old numbered voice exists beside the approved revised version.
  fs.writeFileSync(path.join(root, '05.aiff'), 'unapproved old voice');
  fs.writeFileSync(path.join(root, '05-revised.wav'), 'approved revised voice');
  fs.writeFileSync(path.join(root, 'shot.mp4'), 'video fixture bytes, not playable');
  const cfg = { storage: { local_path: root } };
  const assets = [['video:5', 'shot.mp4', 'video'], ['narration_audio_local_path:5', '05-revised.wav', 'audio']]
    .map(([id, file, type]) => { const f = evidence.fingerprint(root, file); return {
      id, type, local_path: evidence.localFile(root, file), sha256: f.sha256, bytes: f.bytes,
    }; });
  const payload = { schema: 'ai-drama.editing-handoff/v1', run_id: 'run', source_digest: 'approved-snapshot',
    assets, timelines: [{ episode_id: 1, clips: [{ asset_id: 'video:5' }],
      audio: [{ asset_id: 'narration_audio_local_path:5', alignment: 'UNVERIFIED' }],
      dialogue_cues: [{ shot_id: 5, narration: '主管收走方案。' }] }],
    canvas: { aspect_ratio: '9:16' }, policy: { new_generation_budget_cny: 0 } };
  const handoff = { ...payload, handoff_digest: evidence.digest(payload) };
  const receipt = { project_id: 'project', observed_project_id: 'project', handoff_digest: handoff.handoff_digest,
    assets: assets.map((a, i) => ({ source_id: a.id, asset_id: `desktop-${i}`,
      source_sha256: a.sha256, source_bytes: a.bytes })) };
  return { root, cfg, handoff, receipt };
}

test('pins revised voice and text, deterministic plan, no connection or semantic PASS claim', t => {
  const f = fixture(t); const a = adapter.compile(f.handoff, f.cfg);
  assert.deepEqual(a, adapter.compile(f.handoff, f.cfg));
  assert.match(a.imports[1].local_path, /05-revised.wav$/);
  assert.equal(a.timelines[0].dialogue_cues[0].narration, '主管收走方案。');
  assert.equal(a.status, 'AWAITING_DESKTOP_BINDING');
  assert.equal(a.timelines[0].audio[0].alignment, 'UNVERIFIED');
  f.receipt.assets.reverse();
  const bound = adapter.bind(f.handoff, f.cfg, f.receipt, 'project');
  assert.equal(bound.assets[0].asset_id, 'desktop-0');
  assert.equal(bound.desktop_connection_verified, false);
  assert.equal(bound.content_review_required, true);
});

test('rejects edited text/old audio paths and same-path replacement before import or binding', t => {
  const f = fixture(t);
  const changed = structuredClone(f.handoff); changed.timelines[0].dialogue_cues[0].narration = '碎纸机';
  assert.throws(() => adapter.compile(changed, f.cfg), /清单已变化/);
  changed.assets[1].local_path = path.join(f.root, '05.aiff');
  assert.throws(() => adapter.compile(changed, f.cfg), /清单已变化/);
  fs.writeFileSync(f.handoff.assets[1].local_path, 'different revised voice');
  assert.throws(() => adapter.compile(f.handoff, f.cfg), /素材版本已变化/);
  assert.throws(() => adapter.bind(f.handoff, f.cfg, f.receipt, 'project'), /素材版本已变化/);
});

test('rejects wrong project, stale receipt, missing/duplicate/swapped assets and aliased different bytes', t => {
  const f = fixture(t);
  const reject = (edit, pattern) => { const r = structuredClone(f.receipt); edit(r);
    assert.throws(() => adapter.bind(f.handoff, f.cfg, r, 'project'), pattern); };
  reject(r => { r.observed_project_id = 'other'; }, /工程不一致/);
  reject(r => { r.handoff_digest = 'old'; }, /交接版本/);
  reject(r => r.assets.pop(), /不完整/);
  reject(r => { r.assets[1] = r.assets[0]; }, /重复/);
  reject(r => { r.assets[1].source_sha256 = r.assets[0].source_sha256; }, /版本不匹配/);
  reject(r => { r.assets[1].asset_id = r.assets[0].asset_id; }, /同一ChatCut/);
});
