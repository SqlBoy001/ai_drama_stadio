const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
function storageRoot(cfg) {
  return path.resolve((cfg || require('../config').loadConfig()).storage?.local_path || './data/storage');
}
function localFile(root, stored) {
  const input = String(stored || '');
  if (!input || /^https?:|^data:/i.test(input)) throw new Error('素材尚未保存到本地');
  const base = fs.realpathSync(root);
  const file = fs.realpathSync(path.resolve(base, input.replace(/^\/static\//, '')));
  if (!file.startsWith(base + path.sep)) throw new Error('素材超出项目存储目录');
  if (!fs.statSync(file).isFile()) throw new Error('素材不是普通文件');
  return file;
}
function fingerprint(root, stored) {
  const file = localFile(root, stored);
  const fd = fs.openSync(file, 'r');
  try {
    const before = fs.fstatSync(fd);
    if (!before.size || before.size > 1024 * 1024 * 1024) throw new Error('素材为空或超过1GB验收限制');
    const hash = createHash('sha256'), buffer = Buffer.alloc(65536);
    let bytes;
    while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytes));
    const after = fs.fstatSync(fd);
    const live = fs.statSync(file);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || live.ino !== after.ino || live.mtimeMs !== after.mtimeMs) throw new Error('素材在校验期间变化');
    return { path: String(stored), bytes: after.size, sha256: hash.digest('hex') };
  } finally { fs.closeSync(fd); }
}
function manifest(root, entries) {
  return entries.map(({key,path:stored}) => {
    try { return {key, ...fingerprint(root, stored)}; }
    catch (err) { return {key,path:stored || null,error:err.code === 'ENOENT' ? '本地素材不存在' : String(err.message)}; }
  });
}
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
module.exports = { storageRoot, localFile, fingerprint, manifest, digest };
