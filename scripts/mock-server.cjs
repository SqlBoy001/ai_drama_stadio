// Isolated UI acceptance server: no credentials, no production DB, no paid requests.
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const storage = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'drama-preview-'));
require('../backend-node/src/config').loadConfig = () => ({app:{name:'Mock preview',version:'auto'},server:{host:'127.0.0.1'},database:{path:':memory:',type:'sqlite'},storage:{local_path:storage},ai:{}});
process.env.WEB_DIST_PATH = path.join(root, 'frontweb/dist');
const {app,db} = require('../backend-node/src/app').createApp();
const server = app.listen(Number(process.env.PORT) || 5681, '127.0.0.1', () => console.log('Mock preview on http://127.0.0.1:' + server.address().port + '/create'));
function close() {server.close(()=>{db.close();fs.rmSync(storage,{recursive:true,force:true});process.exit(0);});}
process.on('SIGINT',close);process.on('SIGTERM',close);
