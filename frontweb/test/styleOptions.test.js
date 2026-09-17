import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_STYLE_VALUE,
  SUSPENSE_MANHUA_STYLE_VALUE,
  SUSPENSE_REALISTIC_STYLE_VALUE,
  stylePromptMetadataForSave,
  findStyleOption,
  getStyleLabel,
  getStylePromptEn,
  getStylePromptZh,
  recommendWorkbenchStyle,
} from '../src/constants/styleOptions.js'

test('preset returns zh/en prompts', () => {
  const m = stylePromptMetadataForSave('realistic')
  assert.ok(m.style_prompt_zh.includes('写实'))
  assert.ok(m.style_prompt_en.includes('photorealistic'))
})

test('empty style clears prompts', () => {
  assert.deepEqual(stylePromptMetadataForSave(''), {
    style_prompt_zh: '',
    style_prompt_en: '',
  })
})

test('custom with prompt writes same zh/en', () => {
  const desc = '赛博朋克水墨，霓虹映在宣纸上'
  assert.deepEqual(stylePromptMetadataForSave(CUSTOM_STYLE_VALUE, desc), {
    style_prompt_zh: desc,
    style_prompt_en: desc,
  })
})

test('custom without prompt does not write literal custom', () => {
  assert.deepEqual(stylePromptMetadataForSave(CUSTOM_STYLE_VALUE), {
    style_prompt_zh: '',
    style_prompt_en: '',
  })
  assert.deepEqual(stylePromptMetadataForSave(CUSTOM_STYLE_VALUE, '  '), {
    style_prompt_zh: '',
    style_prompt_en: '',
  })
})

test('unknown legacy string still mirrors zh/en', () => {
  assert.deepEqual(stylePromptMetadataForSave('古风仙侠'), {
    style_prompt_zh: '古风仙侠',
    style_prompt_en: '古风仙侠',
  })
})

test('getStyleLabel covers custom and presets', () => {
  assert.equal(getStyleLabel('realistic'), '写实')
  assert.equal(getStyleLabel(CUSTOM_STYLE_VALUE), '自定义')
  assert.equal(getStyleLabel('2d gufeng'), '2D 古风')
  assert.equal(getStyleLabel('unknown-x'), 'unknown-x')
})

test('findStyleOption does not treat custom as preset', () => {
  assert.equal(findStyleOption(CUSTOM_STYLE_VALUE), null)
})

test('getStylePrompt helpers do not return literal custom', () => {
  assert.equal(getStylePromptEn(CUSTOM_STYLE_VALUE), undefined)
  assert.equal(getStylePromptZh(CUSTOM_STYLE_VALUE), undefined)
})

test('suspense manhua preset carries the complete bilingual art direction', () => {
  const m = stylePromptMetadataForSave(SUSPENSE_MANHUA_STYLE_VALUE)
  assert.match(m.style_prompt_zh, /写实二次元/)
  assert.match(m.style_prompt_zh, /低调布光/)
  assert.match(m.style_prompt_en, /psychological suspense/i)
})

test('realistic suspense preset uses real actors instead of anime rendering', () => {
  const m = stylePromptMetadataForSave(SUSPENSE_REALISTIC_STYLE_VALUE)
  assert.match(m.style_prompt_zh, /真人比例/)
  assert.doesNotMatch(m.style_prompt_zh, /^写实二次元|半写实国漫人物/)
  assert.match(m.style_prompt_en, /photorealistic/i)
})

test('workbench recommends realistic suspense art only while style selection remains automatic', () => {
  assert.equal(recommendWorkbenchStyle('悬疑反转', '', '2.5D国漫', true), SUSPENSE_REALISTIC_STYLE_VALUE)
  assert.equal(recommendWorkbenchStyle('恐怖惊悚', '', '2.5D国漫', true), SUSPENSE_REALISTIC_STYLE_VALUE)
  assert.equal(recommendWorkbenchStyle('悬疑反转', '', '水墨国风', false), '水墨国风')
  assert.equal(recommendWorkbenchStyle('都市轻喜剧', '', SUSPENSE_MANHUA_STYLE_VALUE, true), '2.5D国漫')
})
