const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const fs = require('node:fs');
const storage = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'drama-smoke-'));
const configModule = require(path.join(root, 'backend-node/src/config'));
configModule.loadConfig = () => ({app:{name:'scan-mock',version:'test'},server:{host:'127.0.0.1'},database:{path:':memory:',type:'sqlite'},storage:{local_path:storage},ai:{}});
process.env.WEB_DIST_PATH = path.join(root, 'frontweb/dist');
const {app,db} = require(path.join(root,'backend-node/src/app')).createApp();
assert.equal(db.prepare('SELECT count(*) AS n FROM ai_service_configs').get().n,0);
const server = app.listen(0,'127.0.0.1',async()=>{
 try {
  const base='http://127.0.0.1:'+server.address().port;
  async function req(url,body){const r=await fetch(base+url,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});assert.ok(r.ok,await r.clone().text());return r.json();}
  assert.equal((await req('/health')).status,'ok');
  assert.equal((await fetch(base+'/agent-workbench')).status,200);
  let result=await req('/api/v1/agent/runs',{instruction:'做一个《扫描演练》的1集都市故事，每集30秒，预算100元',dry_run:true,episode_count:1,episode_duration_seconds:30,budget_limit:100});
  let run=result.data;assert.ok(run.dry_run);assert.equal(run.status,'SCRIPT_REVIEW');
  for(const state of ['ASSET_REVIEW','FINAL_REVIEW','EXPORTED']){const a=run.approvals.find(a=>a.status==='PENDING');run=(await req('/api/v1/approvals/'+a.id+'/approve',{comment:'isolated mock smoke'})).data;assert.equal(run.status,state);}
  assert.equal(run.usage.length,6);assert.equal(run.qc_reports.length,6);
  console.log('SMOKE PASS: health, frontend route, 3 approvals, 6 mock usage/QC, EXPORTED (state only).');
 }catch(e){console.error(e);process.exitCode=1;}finally{server.close(()=>{db.close();fs.rmSync(storage,{recursive:true,force:true});});}
});
server.on('error',e=>{console.error(e);db.close();fs.rmSync(storage,{recursive:true,force:true});process.exitCode=1;});
