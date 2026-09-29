"""Offline ASR evidence. Optional faster-whisper; never calls a paid API.
Pass a local model directory: download/provision is explicit and separate.
"""
import argparse, hashlib, json, pathlib
p=argparse.ArgumentParser()
p.add_argument('media');p.add_argument('--model',required=True);p.add_argument('--output',required=True)
a=p.parse_args()
media=pathlib.Path(a.media);model=pathlib.Path(a.model);output=pathlib.Path(a.output)
if not media.is_file() or not model.is_dir():p.error('local media and model directory required')
if output.exists():p.error('output exists; choose a new evidence version')
import os
os.environ['HF_HUB_OFFLINE']='1'
import onnxruntime
onnxruntime.disable_telemetry_events()
from faster_whisper import WhisperModel
def fingerprint():
 with media.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
before=fingerprint()
engine=WhisperModel(str(model),device='cpu',compute_type='int8',local_files_only=True)
segments,info=engine.transcribe(str(media),language='zh',beam_size=5,word_timestamps=True,condition_on_previous_text=False,vad_filter=True,vad_parameters={'min_silence_duration_ms':500})
rows=[]
for s in segments:
 rows.append({'start':s.start,'end':s.end,'text':s.text,'avg_logprob':s.avg_logprob,'no_speech_prob':s.no_speech_prob,
 'words':[{'start':w.start,'end':w.end,'word':w.word,'probability':w.probability} for w in s.words or []]})
 print(f'{s.start:.2f}-{s.end:.2f}: {s.text}',flush=True)
if fingerprint()!=before:raise RuntimeError('media changed during transcription')
result={'schema_version':1,'media_sha256':before,'model':model.name,'language':info.language,'duration':info.duration,'vad_filter':True,
 'scope':'完整音轨本地机器转写；不证明音色、情绪、口型或人工听审通过','segments':rows}
with output.open('x') as f:json.dump(result,f,ensure_ascii=False,indent=2)
