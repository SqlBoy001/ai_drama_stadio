const handoffs = require('./editingHandoffService');
const plans = require('./chatcutImportPlan');

function structured(result) {
  if (result?.isError || !result?.structuredContent) throw new Error('ChatCut未返回可核验结果');
  return result.structuredContent;
}
function sameId(short, full) {
  return typeof short === 'string' && short.replaceAll('-', '').length >= 10 &&
    full.replaceAll('-', '').startsWith(short.replaceAll('-', ''));
}

// The host supplies the registered official MCP transport; never discover private
// ports, load a model API, or turn this into a paid media-generation fallback.
async function importAssets(db, cfg, runId, projectId, client) {
  if (typeof projectId !== 'string' || !projectId.trim()) throw new Error('必须指定ChatCut目标工程');
  const original = handoffs.build(db, cfg, runId);
  const plan = plans.compile(original, cfg);
  // Desktop's AIFF rejection was observed in the real sample import. A lossless
  // derivative needs its own provenance; do not silently pick a neighbouring WAV.
  if (plan.imports.some(asset => /\.aiff?$/i.test(asset.local_path))) {
    throw new Error('ChatCut不支持AIFF直接导入，必须先建立可核验的无损WAV转换记录');
  }
  const fresh = () => {
    const current = handoffs.build(db, cfg, runId);
    if (current.handoff_digest !== original.handoff_digest) throw new Error('导入期间批准版本已变化');
    return current;
  };
  const assertProject = async () => {
    const active = structured(await client.callTool('get_active_project', {}));
    if (active.projectId !== projectId) throw new Error('ChatCut目标工程不一致');
  };
  await assertProject();
  const guidelines = structured(await client.callTool('get_guidelines', {}));
  if (!['push_asset', 'inspect_asset'].every(name => guidelines.operations?.some(o => o.name === name))) {
    throw new Error('当前ChatCut工具不支持可核验素材导入');
  }
  const execute = async (name, args) => structured(await client.callTool('execute', { name, arguments: args }));
  const keys = asset => [runId, original.handoff_digest, projectId, asset.id];
  const read = asset => db.prepare(`SELECT * FROM chatcut_asset_imports
    WHERE run_id=? AND handoff_digest=? AND project_id=? AND source_id=?`).get(...keys(asset));
  const finish = (asset, status, id, error) => db.prepare(`UPDATE chatcut_asset_imports
    SET status=?,asset_id=?,error=?,updated_at=?
    WHERE run_id=? AND handoff_digest=? AND project_id=? AND source_id=?`)
    .run(status, id || null, error || null, new Date().toISOString(), ...keys(asset));
  const mapping = [];
  for (const asset of plan.imports) {
    fresh();
    await assertProject();
    let row = read(asset);
    if (row && row.status !== 'IMPORTED') throw new Error(`素材导入结果待核对，禁止自动重试：${asset.id}`);
    if (!row) {
      // Commit intent before the remote call. Concurrent callers and a crash after
      // remote success must not submit the same file a second time.
      db.prepare(`INSERT INTO chatcut_asset_imports
        (run_id,handoff_digest,project_id,source_id,source_sha256,source_bytes,status,updated_at)
        VALUES (?,?,?,?,?,?,'PENDING',?)`)
        .run(...keys(asset), asset.sha256, asset.bytes, new Date().toISOString());
      let importedId;
      try {
        fresh();
        const reply = await execute('push_asset', { filePath: [asset.local_path] });
        const item = reply.results?.[0];
        if (reply.failed !== 0 || reply.succeeded !== 1 || reply.results.length !== 1 ||
            !item?.success || typeof item.assetId !== 'string' || !item.assetId.trim() || item.type !== asset.type) {
          throw new Error('ChatCut导入回执不完整');
        }
        importedId = item.assetId;
        await assertProject();
        fresh();
        const check = (await execute('inspect_asset', { assetId: importedId })).asset;
        if (!check || !sameId(check.id, importedId) || check.type !== asset.type) throw new Error('ChatCut素材回读失败');
        finish(asset, 'IMPORTED', importedId);
      } catch (err) {
        finish(asset, 'UNKNOWN', importedId, String(err.message).slice(0, 500));
        throw err;
      }
      row = read(asset);
    } else {
      const check = (await execute('inspect_asset', { assetId: row.asset_id })).asset;
      if (!check || !sameId(check.id, row.asset_id) || check.type !== asset.type) {
        throw new Error('已导入素材不可回读，禁止自动重复导入');
      }
    }
    mapping.push({ source_id: asset.id, asset_id: row.asset_id,
      source_sha256: row.source_sha256, source_bytes: row.source_bytes });
  }
  await assertProject();
  const binding = plans.bind(fresh(), cfg, { project_id: projectId, observed_project_id: projectId,
    handoff_digest: original.handoff_digest, assets: mapping }, projectId);
  return { ...binding, desktop_connection_verified: true,
    evidence_scope: 'official_transport_readback_and_local_source_hashes',
    limitations: ['素材字节指纹在本地核验；Desktop回读核对ID/类型，非Desktop内部文件哈希证明。',
      '尚未建立时间线或导出；不代表内容验收通过。'] };
}

module.exports = { importAssets };
