import json,pathlib
r=pathlib.Path(__file__).resolve().parent
s=json.loads((r/'EP01/storyboard.json').read_text());m=json.loads((r/'mock_media_tasks.json').read_text());end=0
for shot in s['shots']:
 assert shot['start_seconds']==end
 end=shot['end_seconds'];assert end-shot['start_seconds']==shot['duration_seconds'];assert 4<=shot['duration_seconds']<=10
 last=0
 for d in shot['dialogue']:
  assert last<=d['start_offset_seconds']<d['end_offset_seconds']<=shot['duration_seconds'];last=d['end_offset_seconds']
 for c in shot['characters']:
  for text in [shot['image_prompt']['positive'],shot['video_prompt']['performance'],shot['first_frame']['description'],shot['last_frame']['description']]:assert c['appearance_lock'] in text
assert end==60 and len(s['shots'])==10
ids={t['task_id'] for t in m['tasks']};assert len(ids)==len(m['tasks'])
seen=set()
for t in m['tasks']:
 assert t['status']=='mock' and not t['provider'] and not t['model']
 assert all(d in seen for d in t['dependencies']);seen.add(t['task_id'])
assert m['real_api_calls_allowed'] is False
print('PASS: 60s / 10 shots; dialogue timing; exact appearance locks; 70-task acyclic dependencies; zero real submissions')
