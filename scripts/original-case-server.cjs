// Explicit real-provider acceptance run; fixed user-authorized total reservation cap.
const fs=require('node:fs'),path=require('node:path');
if(!process.argv.includes('--authorized-20-cny'))throw Error('Requires explicit 20 CNY authorization');
const root=path.resolve(__dirname,'..'),backend=path.join(root,'backend-node');
const dir=path.join(backend,'data/production/do-not-open-v01');fs.mkdirSync(dir,{recursive:true});
const Database=require(path.join(backend,'node_modules/better-sqlite3'));
const source=new Database(path.join(backend,'data/drama_generator.db'),{readonly:true});
const cfg={app:{name:'全新素材·20元封顶测试',version:'1'},server:{host:'127.0.0.1',port:5689},database:{type:'sqlite',path:path.join(dir,'project.db')},storage:{local_path:dir},ai:{}};
require(path.join(backend,'src/config')).loadConfig=()=>cfg;
process.env.WEB_DIST_PATH=path.join(root,'frontweb/dist');
const {app,db}=require(path.join(backend,'src/app')).createApp();
const express=require(path.join(backend,'node_modules/express')),gateway=express();gateway.use(express.json({limit:'30mb'}));
const {reserve}=require('./original-case-budget.cjs');
const slots={text:{source:8,model:'doubao-seed-2-0-mini-260428'},vision_review:{source:8,model:'doubao-seed-2-0-mini-260428'},image:{source:4,model:'doubao-seedream-4-5-251128'},storyboard_image:{source:5,model:'doubao-seedream-4-5-251128'},video:{source:6,model:'doubao-seedance-2-0-mini-260615'}};
// Credential use stays in the gateway; neither credentials nor production rows
// are copied into the new project DB or printed to logs.
const columns=source.prepare('PRAGMA table_info(ai_service_configs)').all().map(c=>c.name);
const quote=v=>v==null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const selects=Object.entries(slots).map(([type,slot],i)=>{
 const original=source.prepare('SELECT * FROM ai_service_configs WHERE id=?').get(slot.source);
 if(!original)throw Error('Missing configured provider '+type);
 const row={...original,id:900+i,service_type:type,provider:type==='video'?'volces':'volcengine',name:'20元受控真实调用 '+type,base_url:'http://127.0.0.1:5690/'+type,api_key:'gateway-only',model:JSON.stringify([slot.model]),default_model:slot.model,is_active:1,is_default:1,settings:JSON.stringify({max_tokens:8000}),endpoint:type==='video'?'/contents/generations/tasks':type.includes('image')?'/images/generations':'/chat/completions',query_endpoint:type==='video'?'/contents/generations/tasks/{task_id}':null};
 return 'SELECT '+columns.map(k=>quote(row[k])+' AS "'+k+'"').join(',');
});
db.exec('CREATE TEMP VIEW ai_service_configs AS '+selects.join(' UNION ALL '));
gateway.use('/:slot',async(req,res)=>{
 try {
  const slot=slots[req.params.slot];if(!slot)throw Error('Unsupported provider slot');
  const original=source.prepare('SELECT base_url,api_key FROM ai_service_configs WHERE id=?').get(slot.source);
  const target=new URL(original.base_url.replace(/\/$/,'')+req.url);
  if(!target.hostname.endsWith('.volces.com'))throw Error('Provider origin is not the approved Volcengine API');
  if(!['GET','POST'].includes(req.method))throw Error('Unsupported method');
  if(req.method==='POST') {
   const b=req.body;if(b.model!==slot.model)throw Error('Unapproved model');
   let amount=.25,kind='text-review';
   if(req.params.slot==='video') {
    if(Number(b.duration)!==5||b.resolution!=='720p'||JSON.stringify(b.content).includes('video_url'))throw Error('Only 5s 720p image/text-to-video authorized');
    amount=3;kind='video';
   } else if(req.params.slot.includes('image')) {
    if(Number(b.n||1)!==1||b.sequential_image_generation==='auto')throw Error('Only one image per request authorized');
    kind='image';amount=.25;
   } else {
    const messages=JSON.stringify(b.messages,(_k,v)=>typeof v==='string'&&v.startsWith('data:image')?'[image]':v);
    if(messages.length>60000)throw Error('Text request exceeds reserved token envelope');
    b.max_tokens=Math.min(Number(b.max_tokens)||8000,8000);
   }
   const reserved=reserve(path.join(dir,'budget-ledger.json'),kind,slot.model,amount);
   console.log('PAID REQUEST RESERVED',JSON.stringify({kind,model:slot.model,reserved_cny:reserved}));
  }
  const upstream=await fetch(target,{method:req.method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+original.api_key},...(req.method==='POST'?{body:JSON.stringify(req.body)}:{})});
  const body=Buffer.from(await upstream.arrayBuffer());
  fs.appendFileSync(path.join(dir,'provider-receipts.jsonl'),JSON.stringify({at:new Date().toISOString(),slot:req.params.slot,method:req.method,status:upstream.status,response:body.toString('utf8')})+'\n');
  res.status(upstream.status).set('Content-Type',upstream.headers.get('content-type')||'application/json').send(body);
 }catch(e){console.warn('GATEWAY STOP',e.message);res.status(400).json({error:{message:String(e.message)}});}
});
gateway.listen(5690,'127.0.0.1');app.listen(5689,'127.0.0.1',()=>console.log('REAL CASE READY http://127.0.0.1:5689/create'));
