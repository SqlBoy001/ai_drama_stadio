import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/composables/filmCreate/useCharacters.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('  async function doGenerateCharacterPrompt('),source.indexOf('  async function doExtractCharFromImage('));
const compile=new Function('editCharacterForm','editCharacterPromptGenerating','characterAPI','ElMessage','loadDrama','onGenerateCharacterImage','getSelectedStyle',body+'; return doGenerateCharacterPrompt;');
test('refresh saves live edits before text generation and optional image submission',async()=>{
 const calls=[],form={value:{id:1,name:'甲',appearance:'新服装',description:'背景'}};
 const run=compile(form,{value:false},{update:async(id,p)=>calls.push(['save',p.appearance]),generatePrompt:async()=>{calls.push(['text']);return {polished_prompt:'中文新提示词'}}},{success(){},error(){},warning(){}},async()=>{},async()=>calls.push(['image']),()=> '国漫');
 await run(true);assert.deepEqual(calls,[['save','新服装'],['text'],['image']]);assert.equal(form.value.polished_prompt,'中文新提示词');
});
test('text failure cannot submit an image',async()=>{
 let images=0,errors=0;
 const run=compile({value:{id:1,name:'甲',appearance:'新服装'}},{value:false},{update:async()=>{},generatePrompt:async()=>{throw Error('failed')}},{success(){},error(){errors++},warning(){}},async()=>{},async()=>images++,()=> '国漫');
 await run(true);assert.equal(images,0);assert.equal(errors,1);
});
