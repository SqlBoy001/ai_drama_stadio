'use strict';

/**
 * 角色 appearance 只保存身份事实。清理旧版本曾写入的渲染风格尾句，
 * 避免切换项目画风后角色卡和后续提示词仍携带历史风格。
 */
function stripRenderStyleFromAppearance(value) {
  const text = (value == null ? '' : String(value)).trim();
  if (!text) return text;
  return text
    .replace(/[，,]\s*(?:符合|贴合)\s*2\s*\.\s*5D\s*国漫(?:风格|中的灵异设定)[。.]?/gi, '。')
    .replace(/[，,]\s*(?:符合|贴合)\s*2\.5D\s*国漫(?:风格|中的灵异设定)[。.]?/gi, '。')
    .replace(/。。+/g, '。')
    .replace(/，。/g, '。')
    .trim();
}

function characterPromptMatchesStyle(prompt, cfg) {
  const text = (prompt || '').toString();
  if (!text.trim()) return false;
  const zh = (cfg?.style?.default_style_zh || '').toString().trim();
  const en = (cfg?.style?.default_style_en || cfg?.style?.default_style || '').toString().trim();
  if (!zh && !en) return true;
  return Boolean((zh && text.includes(zh)) || (en && text.includes(en)));
}

module.exports = {
  characterPromptMatchesStyle,
  stripRenderStyleFromAppearance,
};
