# Upstream review and provenance

Reviewed on 2026-09-17. The repositories were cloned only into a temporary directory for read-only review. This skill paraphrases public workflow ideas and data-shape concepts; it does not copy sample stories, images, API keys, bundled agent archives or third-party media.

## Micro-Drama-Skills

- Repository: <https://github.com/zhaihao118/Micro-Drama-Skills>
- Reviewed commit: `b3a521fb92bc0de00c4b17cf2b0a2016b08d10a2`
- License evidence: the README states `MIT`, but the reviewed commit contains no standalone `LICENSE` file. Treat this as weaker evidence than a checked-in license text; reuse only high-level workflow and generic data-structure ideas.
- Reviewed: root README, directory tree, `.claude/skills/produce-anime/SKILL.md`, `.claude/skills/generate-media/SKILL.md`, `.claude/skills/submit-anime-project/SKILL.md`, `.config/visual_styles.json`, representative `metadata.json`, `storyboard_config.json`, media index and task JSON shapes.

Public design ideas adopted in paraphrased form:

- staged script → character/scene/prop references → episodic storyboard → media task pipeline;
- project/episode/shot IDs and reusable reference assets;
- explicit visual-style configuration instead of embedding style ad hoc;
- mock submission as the safe default and resumable stage execution.

### Default-value discrepancy

The upstream materials are internally inconsistent:

- README and representative generated episode configs use two 15-second parts, each with a 6-grid storyboard: 12 shots per 30-second episode.
- The current `produce-anime/SKILL.md` text describes two 9-grid parts: 18 shots per episode.
- Existing task prompts sampled from the repository use six 2.5-second shots per 15-second part.

This project skill follows the user's explicit compatibility requirement: 25 episodes, 30 seconds, 12 shots. It records the discrepancy and never silently changes the count. Because 12 shots at a minimum of 4 seconds cannot fit 30 seconds, the plan preview must block and ask the user to resolve duration or shot count.

The upstream does not define hard defaults for `main_character_limit` or `scene_limit`. It suggests roughly 3–6 reusable core scenes for a 25-episode drama. Therefore this skill uses `null` for both unspecified hard limits and presents a story-driven proposal rather than inventing a source default.

## AIComicBuilder

- Repository: <https://github.com/LingyiChen-AI/AIComicBuilder>
- Reviewed commit: `e01e7dd501131922fb5051ec36926271d394b4d3`
- License: Apache License 2.0 in the root `LICENSE` file.
- Reviewed: README, directory tree, database schema and migrations, character/shot/keyframe prompt builders, character extraction, shot splitting, frame/video generation, continuity and video quality checks, FFmpeg assembly path, and relevant documentation indexes.

Public design ideas adopted in paraphrased form:

- canonical multi-view character reference sheets and visual identity hints;
- separate first-frame and last-frame requirements for interpolated video;
- project/episode storyboard versions and per-asset active/history versions;
- stale markers and narrow downstream invalidation;
- per-shot composition, focal point, depth of field, sound, music and transitions;
- continuity checks between a previous last frame and next first frame;
- pre-assembly verification before FFmpeg concatenation/subtitles/audio work.

## Explicit exclusions

Do not copy or package:

- sample plots, character names, generated images or videos from either repository;
- API endpoints, local service assumptions, credentials or provider-specific secrets;
- zipped third-party agent/workflow packages;
- branded output cards, trademarks or repository-specific UI code;
- prompt wording verbatim when a concise original rule expresses the same public process.

The new skill is provider-neutral and defaults to text/JSON/Mock output. Any later paid invocation requires explicit user authorization and is outside this installation task.
