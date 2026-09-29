const evidence = require('./agentMediaEvidence');
const handoffService = require('./editingHandoffService');

// This is an adapter plan, not a connection or an imported Desktop project.
// A Desktop agent must verify the current tool schema and project before execution.
function validateSources(handoff, cfg) {
  const { handoff_digest, ...payload } = handoff;
  if (handoff.schema !== 'ai-drama.editing-handoff/v1' || evidence.digest(payload) !== handoff_digest) {
    throw new Error('剪辑交接清单已变化，必须重新取得批准版本');
  }
  const ids = new Set();
  for (const asset of handoff.assets) {
    if (!asset.id || ids.has(asset.id)) throw new Error('剪辑素材ID重复或缺失');
    ids.add(asset.id);
    const actual = evidence.fingerprint(evidence.storageRoot(cfg), asset.local_path);
    if (actual.sha256 !== asset.sha256 || actual.bytes !== asset.bytes) {
      throw new Error(`剪辑素材版本已变化：${asset.id}`);
    }
  }
  if (!ids.size) throw new Error('剪辑素材清单为空');
  for (const timeline of handoff.timelines) {
    for (const item of [...timeline.clips, ...timeline.audio]) {
      if (!ids.has(item.asset_id)) throw new Error(`镜头引用了未批准素材：${item.asset_id}`);
    }
  }
}

function compile(handoff, cfg) {
  validateSources(handoff, cfg);
  return {
    schema: 'ai-drama.chatcut-import-plan/v1',
    handoff_digest: handoff.handoff_digest,
    source_digest: handoff.source_digest,
    run_id: handoff.run_id,
    status: 'AWAITING_DESKTOP_BINDING',
    // Do not scan folders, select the newest file, or derive audio filenames from shot numbers.
    imports: handoff.assets.map(asset => ({ ...asset, source_version: handoff.source_digest })),
    timelines: handoff.timelines,
    canvas: handoff.canvas,
    policy: handoff.policy,
    required_checks: ['active_project_identity', 'current_tool_schema', 'source_fingerprints',
      'complete_asset_mapping', 'timeline_readback', 'audio_alignment', 'export_content_review'],
  };
}

function build(db, cfg, runId) {
  return compile(handoffService.build(db, cfg, runId), cfg);
}

// Bind an executor's readback, never infer success from array order or matching names.
// The return value is a mapping only; it must not mark a run EXPORTED or content PASS.
function bind(handoff, cfg, receipt, expectedProjectId) {
  validateSources(handoff, cfg);
  if (typeof expectedProjectId !== 'string' || !expectedProjectId.trim() ||
      receipt?.project_id !== expectedProjectId || receipt.observed_project_id !== expectedProjectId) {
    throw new Error('ChatCut目标工程不一致');
  }
  if (receipt.handoff_digest !== handoff.handoff_digest) throw new Error('ChatCut回读不属于当前交接版本');
  if (!Array.isArray(receipt.assets) || receipt.assets.length !== handoff.assets.length) {
    throw new Error('ChatCut素材映射不完整');
  }
  const mapped = new Map();
  const external = new Map();
  for (const item of receipt.assets) {
    const source = handoff.assets.find(asset => asset.id === item.source_id);
    if (!source || mapped.has(item.source_id)) throw new Error('ChatCut素材映射重复或未知');
    if (typeof item.asset_id !== 'string' || !item.asset_id.trim() ||
        item.source_sha256 !== source.sha256 || item.source_bytes !== source.bytes) {
      throw new Error(`ChatCut回读素材版本不匹配：${item.source_id}`);
    }
    // Reusing a Desktop asset is valid only for identical source bytes and media type.
    const identity = `${source.type}:${source.sha256}:${source.bytes}`;
    if (external.has(item.asset_id) && external.get(item.asset_id) !== identity) {
      throw new Error('不同素材错误绑定到同一ChatCut素材');
    }
    external.set(item.asset_id, identity);
    mapped.set(item.source_id, item.asset_id);
  }
  return {
    schema: 'ai-drama.chatcut-asset-binding/v1',
    project_id: expectedProjectId, handoff_digest: handoff.handoff_digest,
    status: 'ASSET_MAPPING_VALIDATED', evidence_scope: 'executor_receipt_and_local_source_hashes',
    desktop_connection_verified: false, content_review_required: true,
    assets: handoff.assets.map(asset => ({ source_id: asset.id, asset_id: mapped.get(asset.id),
      source_sha256: asset.sha256, source_bytes: asset.bytes })),
  };
}

module.exports = { build, compile, bind };
