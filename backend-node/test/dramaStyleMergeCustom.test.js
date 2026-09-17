'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyStyleOverrideToCfg,
  mergeCfgStyleWithDrama,
  resolvedStreamStyleFromDrama,
} = require('../src/utils/dramaStyleMerge');

test('merge ignores bare custom without metadata prompts', () => {
  const cfg = mergeCfgStyleWithDrama({ style: {} }, { style: 'custom', metadata: {} });
  assert.notEqual(cfg.style?.default_style, 'custom');
  assert.notEqual(cfg.style?.default_style_zh, 'custom');
  assert.notEqual(cfg.style?.default_style_en, 'custom');
});

test('merge uses metadata when style is custom', () => {
  const desc = '赛博朋克水墨';
  const cfg = mergeCfgStyleWithDrama(
    { style: {} },
    { style: 'custom', metadata: { style_prompt_zh: desc, style_prompt_en: desc } },
  );
  assert.equal(cfg.style.default_style_zh, desc);
  assert.equal(cfg.style.default_style_en, desc);
});

test('resolvedStreamStyleFromDrama skips bare custom', () => {
  assert.equal(resolvedStreamStyleFromDrama('custom', null), 'realistic');
  assert.equal(resolvedStreamStyleFromDrama('', { style: 'custom', metadata: {} }), 'realistic');
  assert.equal(
    resolvedStreamStyleFromDrama('', {
      style: 'custom',
      metadata: { style_prompt_en: 'ink neon' },
    }),
    'ink neon',
  );
});

test('style override expands a preset key into bilingual prompts', () => {
  const cfg = applyStyleOverrideToCfg({ style: {} }, 'urban suspense manhua');
  assert.match(cfg.style.default_style_zh, /写实二次元/);
  assert.match(cfg.style.default_style_en, /psychological suspense/i);
});
