# Output contracts

Use these contracts when the skill creates production files. They are normative; omit no required field. Keep prose original to the user's project.

## Common version metadata

Every Markdown file starts with this YAML block. Every JSON document contains equivalent top-level fields.

```yaml
production_version: v01
generated_at: YYYY-MM-DDTHH:MM:SSZ
source_versions: []
supersedes: null
status: draft
```

Use a deterministic project slug and stable IDs. Episode IDs are `EP01`, `EP02`, and so on. Shot IDs are `EP01-S001`, `EP01-S002`, and so on.

## `series_bible.md`

Required sections:

1. Metadata: title, logline, genre, audience, platform, language, copyright status.
2. Production parameters: aspect ratio, episode count/duration, shots per episode, character/scene limits, visual style.
3. World rules: era, geography, social/technical/supernatural rules, rule boundaries.
4. Core promise: viewer fantasy, emotional payoff, novelty, repeatable episode engine.
5. Main plot: inciting incident, progressive complications, midpoint, crisis, climax, ending promise.
6. Character arcs and relationship changes.
7. Visual bible: medium, realism level, palette, lighting, lens/composition, texture, negative style constraints.
8. Episode map table with `episode_id`, title, opening conflict, escalation, irreversible choice, final hook, continuity carry-over.
9. Risk register: copyright, platform, sensitive content, difficult generation, unresolved decisions.

## `character_bible.md`

Each character uses this structure:

```yaml
character_id: CH-001
name: ""
role: protagonist | antagonist | supporting | guest
age_feel: ""
height_body_type: ""
face_identity: ""
hair: ""
costume_id: CST-001
costume_main_color: ""
costume_details: ""
accessories: ""
personality: ""
performance_style: ""
voice_direction: ""
appearance_lock: ""
forbidden_changes: []
allowed_costume_changes: []
reference_views: [front, three_quarter, profile, back]
```

Then provide:

- A multi-view reference prompt that requests one consistent identity, body proportion, hairstyle, costume, accessories and palette in four views.
- A face close-up prompt for identity checking.
- A negative prompt for identity drift, age drift, hairstyle drift, costume/color drift, anatomy errors and unwanted text.
- Relationship and blocking notes.

`appearance_lock` must contain, in one reusable string: face/body appearance, hair, costume main color or costume ID, and age feel. Copy it verbatim into all related shot prompts.

## `EPxx/script.md`

Required sections:

```text
Metadata and version
Episode promise
Continuity from previous episode
0–3s opening conflict
Scene-by-scene screenplay
Mid-episode escalations
Final 5s reversal/cliffhanger
Continuity handed to next episode
Dialogue timing audit
```

For every scene specify location/time, visible characters and costume IDs, character objective, obstacle, physical action, dialogue, sound, and outcome. Dialogue timing table columns: speaker, line, non-punctuation character count, rate, estimated seconds, available seconds, result.

## `EPxx/storyboard.json`

Use valid JSON, not JSONC. Required shape:

```json
{
  "schema_version": "1.0",
  "production_version": "v01",
  "generated_at": "YYYY-MM-DDTHH:MM:SSZ",
  "source_versions": ["series_bible:v01", "character_bible:v01", "EP01/script:v01"],
  "supersedes": null,
  "episode_id": "EP01",
  "title": "",
  "target_duration_seconds": 60,
  "aspect_ratio": "9:16",
  "visual_style": {
    "preset": "电影级写实动画",
    "medium": "cinematic realistic animation",
    "palette": "",
    "lighting": "",
    "negative_constraints": []
  },
  "story_structure": {
    "opening_conflict_end_seconds": 3,
    "escalation_summary": "",
    "final_hook_start_seconds": 55,
    "final_hook": ""
  },
  "shots": [
    {
      "shot_id": "EP01-S001",
      "shot_version": 1,
      "sequence": 1,
      "start_seconds": 0,
      "end_seconds": 5,
      "duration_seconds": 5,
      "beat_role": "hook",
      "scene_id": "SC-001",
      "shot_size": "close_up",
      "camera_angle": "eye_level",
      "camera_movement": "slow_push_in",
      "composition": "rule_of_thirds",
      "focal_point": "",
      "depth_of_field": "shallow",
      "characters": [
        {
          "character_id": "CH-001",
          "name": "",
          "costume_id": "CST-001",
          "appearance_lock": "人物外形；发型；服装主色/套装；年龄感",
          "screen_position_start": "",
          "screen_position_end": "",
          "eye_line": ""
        }
      ],
      "props": [
        {
          "prop_id": "PROP-001",
          "state_start": "",
          "state_end": "",
          "held_by": "CH-001"
        }
      ],
      "action": {
        "start_pose": "",
        "timed_beats": ["0–2s: ...", "2–5s: ..."],
        "end_pose": "",
        "emotion_change": ""
      },
      "dialogue": [
        {
          "speaker_id": "CH-001",
          "text": "",
          "emotion": "",
          "estimated_seconds": 0,
          "start_offset_seconds": 0,
          "end_offset_seconds": 0
        }
      ],
      "sound": {
        "ambience": "",
        "sfx": [],
        "music_cue": ""
      },
      "transition_in": "cut",
      "transition_out": "cut",
      "image_prompt": {
        "positive": "",
        "negative": "",
        "reference_assets": []
      },
      "video_prompt": {
        "performance": "",
        "motion": "",
        "camera": "",
        "continuity": "",
        "negative": ""
      },
      "first_frame": {
        "description": "",
        "required_state": [],
        "reference_assets": []
      },
      "last_frame": {
        "description": "",
        "required_state": [],
        "handoff_to_next_shot": ""
      },
      "continuity_checks": {
        "identity": "pending",
        "costume": "pending",
        "position_and_eye_line": "pending",
        "prop_state": "pending",
        "lighting_and_palette": "pending",
        "previous_last_to_current_first": "pending"
      },
      "post_overlays": [],
      "risk_flags": []
    }
  ],
  "timing_validation": {
    "shot_count": 12,
    "sum_duration_seconds": 60,
    "all_shots_between_4_and_10_seconds": true,
    "dialogue_timing_pass": true
  }
}
```

Allowed `beat_role` values: `hook`, `setup`, `escalation`, `reveal`, `choice`, `payoff`, `cliffhanger`. Use plain cuts for most continuous action. Use dissolves/fades only for motivated time, location or emotional transitions.

### Prompt construction rule

For every character visible in a shot, repeat this order in all four prompt locations (`image_prompt.positive`, `video_prompt.performance`, `first_frame.description`, `last_frame.description`):

```text
[character name + exact appearance_lock] + position + body pose + facial performance + interaction + lighting response
```

Then add scene, composition, camera, palette, medium and negative constraints. Never replace the exact lock with “same as reference,” “same outfit,” or pronouns alone.

## `mock_media_tasks.json`

```json
{
  "schema_version": "1.0",
  "mode": "mock",
  "real_api_calls_allowed": false,
  "production_version": "v01",
  "tasks": [
    {
      "task_id": "TASK-EP01-S001-FIRST",
      "type": "first_frame",
      "status": "mock",
      "episode_id": "EP01",
      "shot_id": "EP01-S001",
      "input_versions": [],
      "dependencies": [],
      "reference_assets": [],
      "prompt": "",
      "output_placeholder": "EP01/media/EP01-S001-first-v01.png",
      "provider": null,
      "model": null,
      "estimated_calls": 1,
      "estimated_cost": null,
      "stale_if": ["character lock changes", "shot prompt changes"],
      "manual_asset_policy": "reuse_locked_manual"
    }
  ]
}
```

Valid types: `character_turnaround`, `character_face_ref`, `scene_ref`, `prop_ref`, `first_frame`, `last_frame`, `shot_video`, `tts`, `subtitle`, `assembly_preflight`. A manually supplied/generated asset is never replaced automatically; create another asset version and let the user choose the active version.

## `EPxx/qc_report.md`

Required summary table:

| Gate | Status | Evidence | Affected IDs | Required action |
|---|---|---|---|---|
| Timing | PASS/WARN/BLOCKED | | | |
| Opening conflict | | | | |
| Mid escalation | | | | |
| Final hook | | | | |
| Dialogue pace | | | | |
| Character identity | | | | |
| Costume/hair/age | | | | |
| Spatial continuity | | | | |
| First/last frame handoff | | | | |
| Prompt lock coverage | | | | |
| Copyright/platform risk | | | | |
| Assembly preflight | | | | |

After the table include detailed findings, recommended rerun scope, assets preserved, stale downstream tasks and a final release decision.

### Assembly preflight

Do not run FFmpeg merely to claim a check passed. If actual media exists and local read-only inspection is authorized, use `ffprobe` to verify:

- every active clip exists, is non-empty and decodes;
- dimensions and aspect ratio match project settings;
- frame rates and time bases are compatible;
- video/audio codecs are supported by the intended FFmpeg command;
- actual clip durations are within the declared tolerance;
- audio channel layouts and sample rates can be normalized;
- subtitle cues are ordered and within the final duration;
- each transition is supported and shorter than both adjacent clips;
- output path is writable and input ordering follows shot sequence.

If files do not exist, mark this gate `PENDING`, not `PASS`.
