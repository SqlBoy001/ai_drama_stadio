const { createHash } = require('node:crypto');
// Keep render-relevant asset defaults in addition to per-instance overrides. A
// text-only snapshot misses changes to shared templates used by many captions.
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
async function capture(items, execute, captionsPresent = false) {
  const assets = [], gaps = [], seen = new Set();
  async function asset(id, kind) {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const result = await execute('inspect_asset', {assetId:id, ...(['effect','transition'].includes(kind)?{includeCode:true}:{})});
    const a = result.asset;
    if (!a || !a.id || !a.type) throw Error('图层资产回读不完整');
    // Empty html is common for Desktop Remotion assets. Do not treat metadata
    // or a familiar asset ID as proof that its implementation has not changed.
    const code = result.code || a.code || a.html;
    const source = typeof code === 'string' && code.trim() ? code : null;
    if (!source) gaps.push({asset_id:id,kind,reason:'绘制源码不可读取，不能证明模板未变化'});
    assets.push({id:a.id,type:a.type,width:a.width,height:a.height,duration:a.duration,
      runtime:a.runtime,properties:a.properties,metadata:a.metadata,source_sha256:source?digest(source):null});
  }
  for (const entry of items) {
    if (entry.item.type === 'motion-graphic') await asset(entry.item.assetId,'motion-graphic');
    else if (!['video','audio'].includes(entry.item.type)) gaps.push({item_id:entry.item.id,reason:'尚未覆盖该图层类型的源版本'});
    for (const [key,kind] of [['attachedEffects','effect'],['transitions','transition']]) {
      for (const fx of entry[key] || []) {
        const id=fx.assetId || fx.asset?.id;
        if (!id) gaps.push({item_id:entry.item.id,kind,reason:'特效缺少可核验资产引用'});
        else await asset(id,kind);
      }
    }
  }
  let captions=null;
  if (captionsPresent) {
    // Until Desktop's caption pagination is explicitly verified, preserve its
    // response as evidence but do not silently claim full-card coverage.
    captions=await execute('read_captions',{json:JSON.stringify({limit:100,offset:0,words:true})});
    gaps.push({kind:'native-captions',reason:'原生字幕分页完整性尚未核实'});
  }
  return {schema_version:1,assets,captions,gaps,complete:gaps.length===0};
}
module.exports={capture};
