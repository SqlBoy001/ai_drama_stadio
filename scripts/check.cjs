const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (process.argv[2] === 'test') {
  for (const project of ['backend-node', 'frontweb']) run(['--test', ...files(path.join(root, project, 'test')).filter(f => f.endsWith('.test.js'))], path.join(root, project));
} else {
  const sources = ['backend-node/src', 'frontweb/src', 'scripts'].flatMap(dir => files(path.join(root, dir))).filter(f => /\.(js|cjs)$/.test(f));
  for (const file of sources) run(['--check', file]);
  console.log(`Syntax checked ${sources.length} JavaScript files. No TypeScript/typecheck configured; build checks Vue compilation.`);
}
