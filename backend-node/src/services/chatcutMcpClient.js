const { spawn } = require('node:child_process');
const path = require('node:path');
const ALLOWED = new Set(['push_asset','inspect_asset','manage_timelines','edit_track','edit_item',
  'preview_timeline','inspect_item','read_project','read_captions','local_export']);

function createClient({ spawnProcess = spawn, timeoutMs = 45000 } = {}) {
  const child = spawnProcess('python3', [path.resolve(__dirname, '../../scripts/chatcut_registered_mcp.py')],
    { stdio: ['pipe','pipe','pipe'] });
  let sequence = 0, buffer = '', closed = false;
  const pending = new Map();
  const fail = message => {
    if (closed) return;
    closed = true;
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error(message)); }
    pending.clear(); child.kill();
  };
  child.on('error', () => fail('ChatCut传输无法启动'));
  child.on('close', () => fail('ChatCut连接已关闭；结果不明的修改不能自动重试'));
  // Never forward registration environment or raw process logs to HTTP clients.
  child.stderr.on('data', () => {});
  child.stdin.on('error', () => fail('ChatCut连接写入失败'));
  child.stdout.on('data', chunk => {
    buffer += chunk.toString();
    if (Buffer.byteLength(buffer) > 8 * 1024 * 1024) return fail('ChatCut响应超限');
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      if (!line.trim()) continue;
      let message;
      try { message = JSON.parse(line); } catch { fail('ChatCut返回无效协议'); return; }
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id); clearTimeout(request.timer);
      if (message.error) request.reject(new Error(`ChatCut操作失败：${String(message.error.message || '未知错误').slice(0, 500)}`));
      else request.resolve(message.result);
    }
  });
  const request = (method, params) => new Promise((resolve, reject) => {
    if (closed) return reject(new Error('ChatCut连接不可用'));
    const id = ++sequence;
    const timer = setTimeout(() => fail('ChatCut响应超时；结果不明的修改不能自动重试'), timeoutMs);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const ready = request('initialize', { protocolVersion: '2024-11-05', capabilities: {},
    clientInfo: { name: 'ai-drama-desktop', version: '1.0' } }).then(() => {
    child.stdin.write(JSON.stringify({ jsonrpc:'2.0', method:'notifications/initialized' }) + '\n');
  });
  // Avoid an unhandled rejection if the caller closes before making its first call.
  ready.catch(() => {});
  return {
    async callTool(name, args = {}) {
      if (!['get_active_project','get_guidelines','execute'].includes(name) ||
          (name === 'execute' && !ALLOWED.has(args.name))) throw new Error('不允许此ChatCut操作');
      await ready;
      const result = await request('tools/call', { name, arguments: args });
      if (result?.isError) throw new Error('ChatCut工具拒绝操作，请检查Desktop；不会自动重试');
      if (result && !result.structuredContent) {
        const texts = result.content?.filter(item => item.type === 'text') || [];
        if (texts.length === 1) {
          try {
            const parsed = JSON.parse(texts[0].text);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) result.structuredContent = parsed;
          } catch { /* A human-readable response is not a machine-verifiable result. */ }
        }
      }
      return result;
    },
    close() { fail('ChatCut连接已结束'); },
  };
}
module.exports = { createClient };
