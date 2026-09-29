const fs = require('node:fs');
function reserve(file, kind, model, amount, limit = 20) {
  if (!(amount > 0) || !Number.isFinite(amount) || limit !== 20) throw Error('Invalid budget reservation');
  const entries = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  const cents = Math.round(amount * 100);
  const total = entries.reduce((sum, row) => sum + row.cents, 0);
  if (total + cents > 2000) throw Error('20元预算预留已不足，停止新增请求');
  entries.push({ at: new Date().toISOString(), kind, model, cents, status: 'RESERVED_NOT_BILL' });
  // One gateway process; synchronous reservation precedes every network request.
  fs.writeFileSync(file + '.tmp', JSON.stringify(entries, null, 2), { mode: 0o600 });
  fs.renameSync(file + '.tmp', file);
  return (total + cents) / 100;
}
module.exports = { reserve };
