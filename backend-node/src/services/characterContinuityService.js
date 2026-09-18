const { isAudioOnlyCharacter } = require('./shotPresence');
const WARDROBE_TRANSITION_RE = /换上|换成|换装|改穿|穿上|脱下|脱掉|脱去|变装|变成|幻化|撕下|外套滑落/;
const GARMENT_RE = /(?:针织开衫|开衫|连衣裙|长裙|短裙|半身裙|红裙|裙装|裙子|卫衣|衬衫|西装|风衣|大衣|夹克|毛衣|T恤|上衣|长裤|短裤|裤子|制服|汉服|旗袍|长袍|袍服|外套|裙)/;
const COLOR_RE = /米白|纯白|乳白|浅色|深色|白色?|黑色?|红色?|深红|暗红|蓝色?|灰色?|浅灰|深灰|绿色?|黄色?|紫色?|粉色?|棕色?|卡其|杏色|藏青/;

function safeJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function parseCharacterIds(value) {
  const list = safeJson(value, []);
  if (!Array.isArray(list)) return [];
  return [...new Set(list
    .map((item) => Number(typeof item === 'object' && item != null ? item.id : item))
    .filter(Number.isFinite))];
}

function cleanWardrobe(value) {
  return String(value || '')
    .replace(/^(?:身穿|穿着|身着|穿上|换上|换成|改穿|一身)\s*/, '')
    .replace(/(?:站在|坐在|走在|倚在|躺在|出现在|来到|面带|双手|嘴角|胸口|下摆).*$/u, '')
    .replace(/^[，、；\s]+|[，、；\s]+$/g, '')
    .trim();
}

function garmentPhraseFrom(value) {
  const text = cleanWardrobe(value);
  if (!text) return '';
  const garment = text.match(new RegExp(`^(.{0,28}?${GARMENT_RE.source})`, 'u'));
  return cleanWardrobe(garment ? garment[1] : text.slice(0, 32));
}

function extractReferenceWardrobe(appearance) {
  const text = String(appearance || '').trim();
  if (!text) return '';
  const dressed = text.match(/(?:身穿|穿着|身着)([^。；\n]+)/u);
  if (dressed) {
    return cleanWardrobe(dressed[1].replace(/，?整体.*$/u, ''));
  }
  const colored = text.match(new RegExp(`((?:${COLOR_RE.source})[^，。；\\n]{0,28}${GARMENT_RE.source})`, 'u'));
  return colored ? cleanWardrobe(colored[1]) : '';
}

function relevantCharacterText(text, characterName) {
  const source = String(text || '');
  if (!characterName || !source.includes(characterName)) return '';
  const clauses = source.split(/[。！？；\n]/u).filter((part) => part.includes(characterName));
  return clauses.join('。');
}

function extractExplicitWardrobe(text, characterName) {
  const relevant = relevantCharacterText(text, characterName);
  if (!relevant) return '';

  // 明确换装时，新服装必须优先于“脱下的旧服装”。
  const changed = relevant.match(new RegExp(`(?:换上|换成|改穿|穿上|变装为|变成)([^，。；\\n]{1,36}?${GARMENT_RE.source})`, 'u'));
  if (changed) return garmentPhraseFrom(changed[1]);

  const worn = relevant.match(new RegExp(`(?:身穿|穿着|身着|穿)([^，。；\\n]{1,36}?${GARMENT_RE.source})`, 'u'));
  if (worn) return garmentPhraseFrom(worn[1]);

  const colored = relevant.match(new RegExp(`((?:${COLOR_RE.source})[^，。；\\n]{0,24}?${GARMENT_RE.source})`, 'u'));
  if (colored) return garmentPhraseFrom(colored[1]);
  return '';
}

function wardrobeSignature(value) {
  const text = cleanWardrobe(value);
  if (!text) return '';
  const colors = [...text.matchAll(new RegExp(COLOR_RE.source, 'gu'))].map((match) => match[0]);
  const garments = [...text.matchAll(new RegExp(GARMENT_RE.source, 'gu'))].map((match) => match[0]);
  return [...new Set([...colors, ...garments])].join('|') || text.replace(/\s+/g, '');
}

function sameWardrobe(a, b) {
  const aa = wardrobeSignature(a);
  const bb = wardrobeSignature(b);
  if (!aa || !bb) return false;
  if (aa === bb) return true;
  const colorA = String(a).match(COLOR_RE)?.[0] || '';
  const colorB = String(b).match(COLOR_RE)?.[0] || '';
  const familyA = /裙/.test(a) ? '裙' : String(a).match(GARMENT_RE)?.[0] || '';
  const familyB = /裙/.test(b) ? '裙' : String(b).match(GARMENT_RE)?.[0] || '';
  return Boolean(colorA && colorB && colorA === colorB && familyA && familyA === familyB);
}

function storyboardText(row) {
  return [row.action, row.result, row.image_prompt, row.video_prompt].filter(Boolean).join('。');
}

function getCharactersByDrama(db, dramaId) {
  return db.prepare(
    'SELECT id, name, appearance FROM characters WHERE drama_id = ? AND deleted_at IS NULL ORDER BY id'
  ).all(Number(dramaId));
}

function hasExistingUnverifiedStoryboardImage(db, row) {
  try {
    const latest = db.prepare(
      "SELECT prompt FROM image_generations WHERE storyboard_id = ? AND status = 'completed' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1"
    ).get(Number(row.id));
    if (latest) return !String(latest.prompt || '').includes('【人物服装连戏最高优先级】');
  } catch (_) {
    // 精简测试库或旧 schema 无 image_generations 时，继续用分镜当前图片字段判断。
  }
  return Boolean(row.image_url || row.local_path);
}

function hasExistingUnverifiedStoryboardVideo(db, row) {
  try {
    const latest = db.prepare(
      "SELECT prompt FROM video_generations WHERE storyboard_id = ? AND status = 'completed' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1"
    ).get(Number(row.id));
    return Boolean(latest && !String(latest.prompt || '').includes('【人物服装连戏最高优先级】'));
  } catch (_) {
    return false;
  }
}

function auditEpisodeContinuity(db, episodeId, options = {}) {
  const apply = options.apply === true;
  const episode = db.prepare('SELECT id, drama_id FROM episodes WHERE id = ? AND deleted_at IS NULL').get(Number(episodeId));
  if (!episode) throw new Error('剧集不存在');

  const characters = getCharactersByDrama(db, episode.drama_id);
  const characterMap = new Map(characters.map((character) => [Number(character.id), character]));
  const rows = db.prepare(
    `SELECT id, episode_id, storyboard_number, title, characters, action, result,
            image_prompt, video_prompt, continuity_snapshot, image_url, local_path
       FROM storyboards
      WHERE episode_id = ? AND deleted_at IS NULL
      ORDER BY storyboard_number ASC, id ASC`
  ).all(Number(episodeId));

  const activeWardrobes = new Map();
  const seenCharacters = new Set();
  const issues = [];
  const affectedIds = [];
  const affectedNumbers = [];
  const regenerateIds = [];
  const regenerateNumbers = [];
  const regenerateVideoIds = [];
  const regenerateVideoNumbers = [];
  const updates = [];

  for (const row of rows) {
    const ids = parseCharacterIds(row.characters);
    const shotText = storyboardText(row);
    const hasTransition = WARDROBE_TRANSITION_RE.test(shotText);
    const oldSnapshot = safeJson(row.continuity_snapshot, {});
    let rowNeedsRegeneration = false;
    const snapshot = {
      ...oldSnapshot,
      version: 2,
      generated_by: 'deterministic_character_continuity_audit',
      characters: {},
    };

    for (const characterId of ids) {
      const character = characterMap.get(characterId);
      if (!character?.name || isAudioOnlyCharacter(row, character.name)) continue;
      const name = String(character.name).trim();
      const referenceWardrobe = extractReferenceWardrobe(character.appearance);
      const explicitWardrobe = extractExplicitWardrobe(shotText, name);
      const active = activeWardrobes.get(characterId);
      const firstNarrativeAppearance = !seenCharacters.has(characterId);
      let state = active || null;
      let source = active ? 'inherited' : 'character_card';
      let sourceShot = active?.source_storyboard_number || null;
      let referenceConflict = false;

      if (explicitWardrobe) {
        if (!active || firstNarrativeAppearance) {
          state = {
            clothing: explicitWardrobe,
            source_storyboard_number: row.storyboard_number,
            reference_wardrobe: referenceWardrobe || null,
            source_type: 'storyboard_explicit',
          };
          source = 'storyboard_explicit';
          sourceShot = row.storyboard_number;
          referenceConflict = Boolean(referenceWardrobe && !sameWardrobe(referenceWardrobe, explicitWardrobe));
          if (referenceConflict) {
            rowNeedsRegeneration = true;
            issues.push({
              type: 'reference_outfit_conflict',
              severity: 'warning',
              character_id: characterId,
              character_name: name,
              storyboard_id: row.id,
              storyboard_number: row.storyboard_number,
              expected_clothing: explicitWardrobe,
              conflicting_clothing: referenceWardrobe,
              message: `${name}在第${row.storyboard_number}镜的剧情服装“${explicitWardrobe}”与角色参考图“${referenceWardrobe}”冲突；已以剧情服装为准。`,
            });
          }
        } else if (sameWardrobe(active.clothing, explicitWardrobe)) {
          state = active;
          source = 'inherited_confirmed';
          sourceShot = active.source_storyboard_number;
        } else if (hasTransition) {
          state = {
            clothing: explicitWardrobe,
            source_storyboard_number: row.storyboard_number,
            reference_wardrobe: referenceWardrobe || active.reference_wardrobe || null,
            source_type: 'explicit_transition',
          };
          source = 'explicit_transition';
          sourceShot = row.storyboard_number;
        } else {
          state = active;
          rowNeedsRegeneration = true;
          source = 'inherited_conflict_resolved';
          sourceShot = active.source_storyboard_number;
          issues.push({
            type: 'unexpected_wardrobe_change',
            severity: 'error',
            character_id: characterId,
            character_name: name,
            storyboard_id: row.id,
            storyboard_number: row.storyboard_number,
            expected_clothing: active.clothing,
            conflicting_clothing: explicitWardrobe,
            message: `${name}在第${row.storyboard_number}镜没有换装动作，却从“${active.clothing}”变为“${explicitWardrobe}”；已继续锁定上一镜服装。`,
          });
        }
      } else if (active) {
        state = active;
        source = 'inherited';
        sourceShot = active.source_storyboard_number;
        if (active.source_type !== 'character_card') {
          issues.push({
            type: 'inherited_wardrobe',
            severity: 'info',
            character_id: characterId,
            character_name: name,
            storyboard_id: row.id,
            storyboard_number: row.storyboard_number,
            expected_clothing: active.clothing,
            message: `${name}在第${row.storyboard_number}镜未复述服装；已从第${active.source_storyboard_number}镜继承“${active.clothing}”。`,
          });
        }
      } else if (referenceWardrobe) {
        state = {
          clothing: referenceWardrobe,
          source_storyboard_number: row.storyboard_number,
          reference_wardrobe: referenceWardrobe,
          source_type: 'character_card',
        };
        source = 'character_card';
        sourceShot = row.storyboard_number;
      }

      if (state?.clothing) {
        activeWardrobes.set(characterId, state);
        const previousCharSnapshot = oldSnapshot?.characters?.[name] || {};
        const conflictsWithReference = Boolean(
          state.reference_wardrobe && !sameWardrobe(state.reference_wardrobe, state.clothing)
        );
        if (conflictsWithReference) rowNeedsRegeneration = true;
        snapshot.characters[name] = {
          ...previousCharSnapshot,
          character_id: characterId,
          clothing: state.clothing,
          locked: true,
          source,
          source_storyboard_number: sourceShot,
          reference_wardrobe: state.reference_wardrobe || null,
          reference_outfit_conflict: referenceConflict || conflictsWithReference,
        };
      }
      seenCharacters.add(characterId);
    }

    const nextJson = JSON.stringify(snapshot);
    let oldComparable = '';
    try { oldComparable = JSON.stringify(JSON.parse(row.continuity_snapshot || '{}')); } catch (_) {}
    if (oldComparable !== nextJson) {
      affectedIds.push(row.id);
      affectedNumbers.push(row.storyboard_number);
      updates.push({ id: row.id, snapshot: nextJson });
    }
    if (rowNeedsRegeneration && hasExistingUnverifiedStoryboardImage(db, row)) {
      regenerateIds.push(row.id);
      regenerateNumbers.push(row.storyboard_number);
    }
    if (rowNeedsRegeneration && hasExistingUnverifiedStoryboardVideo(db, row)) {
      regenerateVideoIds.push(row.id);
      regenerateVideoNumbers.push(row.storyboard_number);
    }
  }

  if (apply && updates.length) {
    const update = db.prepare(
      'UPDATE storyboards SET continuity_snapshot = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL'
    );
    const applyUpdates = db.transaction(() => {
      const now = new Date().toISOString();
      for (const item of updates) update.run(item.snapshot, now, item.id);
    });
    applyUpdates();
  }

  return {
    episode_id: Number(episodeId),
    applied: apply,
    checked_storyboards: rows.length,
    affected_storyboard_ids: affectedIds,
    affected_storyboard_numbers: affectedNumbers,
    regenerate_storyboard_ids: regenerateIds,
    regenerate_storyboard_numbers: regenerateNumbers,
    regenerate_video_storyboard_ids: regenerateVideoIds,
    regenerate_video_storyboard_numbers: regenerateVideoNumbers,
    issues,
    summary: {
      reference_conflicts: issues.filter((issue) => issue.type === 'reference_outfit_conflict').length,
      unexpected_changes: issues.filter((issue) => issue.type === 'unexpected_wardrobe_change').length,
      inherited_locks: issues.filter((issue) => issue.type === 'inherited_wardrobe').length,
    },
  };
}

function getStoryboardSnapshot(db, storyboardId) {
  const row = db.prepare(
    'SELECT id, episode_id, action, result, continuity_snapshot FROM storyboards WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(storyboardId));
  if (!row) return null;
  let snapshot = safeJson(row.continuity_snapshot, null);
  if (!snapshot?.characters || Object.keys(snapshot.characters).length === 0) {
    auditEpisodeContinuity(db, row.episode_id, { apply: true });
    const refreshed = db.prepare('SELECT continuity_snapshot FROM storyboards WHERE id = ?').get(Number(storyboardId));
    snapshot = safeJson(refreshed?.continuity_snapshot, null);
  }
  if (snapshot?.characters) {
    snapshot.characters = Object.fromEntries(Object.entries(snapshot.characters)
      .filter(([name]) => !isAudioOnlyCharacter(row, name)));
  }
  return snapshot;
}

function buildContinuityLock(snapshot) {
  if (!snapshot?.characters) return '';
  const lines = [];
  const conflicts = [];
  for (const [name, state] of Object.entries(snapshot.characters)) {
    if (!state?.clothing) continue;
    lines.push(`- ${name}：从头到脚始终穿同一套“${state.clothing}”；颜色、款式、材质、长度和穿着层次必须与相邻镜头完全一致，禁止自行增加或脱掉外套。`);
    if (state.reference_outfit_conflict && state.reference_wardrobe) {
      conflicts.push(`- ${name}：忽略参考图中的${state.reference_wardrobe}，当前镜头唯一有效服装是“${state.clothing}”。`);
    }
  }
  if (!lines.length) return '';
  return [
    '【人物服装连戏最高优先级】',
    ...lines,
    '角色参考图只用于锁定脸型、五官、发型、年龄和体型，不得继承或复制其中的服装。',
    ...conflicts,
    '除非当前动作明确出现换装、脱衣或变装过程，否则任何服装变化都视为生成失败。',
  ].join('\n');
}

function applyStoryboardContinuityLock(db, storyboardId, prompt) {
  const base = String(prompt || '').split('【人物服装连戏最高优先级】')[0].trim();
  if (!storyboardId || !base) return base;
  const lock = buildContinuityLock(getStoryboardSnapshot(db, storyboardId));
  return lock ? `${base}\n${lock}` : base;
}

function annotateCharacterReferenceLabels(referenceContextNote) {
  if (!referenceContextNote) return referenceContextNote;
  return String(referenceContextNote).replace(
    /(character appearance reference for "[^"]+"[^\n]*)/gi,
    '$1 (IDENTITY ONLY: use face, hair, age and body proportions; ignore reference clothing and obey the WARDROBE CONTINUITY LOCK)'
  );
}

module.exports = {
  auditEpisodeContinuity,
  applyStoryboardContinuityLock,
  annotateCharacterReferenceLabels,
  buildContinuityLock,
  extractExplicitWardrobe,
  extractReferenceWardrobe,
  parseCharacterIds,
  sameWardrobe,
};
