const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createClient } = require('../src/services/chatcutMcpClient');
function processFixture(handler) {
  const p = new EventEmitter(); p.stdin = new PassThrough(); p.stdout = new PassThrough(); p.stderr = new PassThrough();
  p.kill = () => p.emit('close');
  p.stdin.on('data', chunk => {
    for (const line of chunk.toString().trim().split('\n')) {
      const message = JSON.parse(line);
      if (!message.id) continue;
      if (message.method === 'initialize') p.stdout.write(JSON.stringify({ id: message.id, result: {} }) + '\n');
      else handler(message, p);
    }
  });
  return p;
}
test('real Desktop JSON-text tool response is normalized without executing prose', async () => {
  const c = createClient({ spawnProcess: () => processFixture((m,p) => p.stdout.write(JSON.stringify({ id:m.id,
    result:{content:[{type:'text',text:JSON.stringify({operations:[{name:'push_asset'}]})}]}})+'\n')) });
  try {
    assert.equal((await c.callTool('get_guidelines')).structuredContent.operations[0].name,'push_asset');
    await assert.rejects(c.callTool('execute',{name:'generate_video'}),/不允许/);
  } finally { c.close(); }
});
test('timeout closes session and does not replay remote operations', async () => {
  let calls=0;const c=createClient({timeoutMs:20,spawnProcess:()=>processFixture(()=>{calls++;})});
  await assert.rejects(c.callTool('get_active_project'),/超时/);
  await assert.rejects(c.callTool('get_active_project'),/不可用/);assert.equal(calls,1);c.close();
});
