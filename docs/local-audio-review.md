# 本地音频审核任务

成片回传后，如果本机已安装语音模型，工作台自动排队执行本地转写。历史文件可点击“核对这版音频”。不连接ChatCut、不调用付费API、不自动下载模型、不重新生成素材，也不自动批准成片。

## 工作流与边界

- QUEUED → RUNNING → DONE；运行失败记录FAILED，显式重试才重新执行。重启遗留任务记INTERRUPTED，不自动重放。
- 单进程一次执行一个转写，最多5个等待任务，每任务10分钟超时；输出最大2MB。多服务进程共享数据库目前不支持，部署仅单实例。
- 任务绑定job/文件SHA/时间线摘要，文件换版或同路径篡改后旧证据失效。旧结果保留在数据库，当前版本不会沿用其他导出文件的结果。
- 台词时段取已采纳的实际音轨位置，不按旧分镜序号计算。静音轨跳过；源裁切/变速保留对齐缺口，不能假定完整台词仍在。
- VAD滤除无语音区域；逐词时间按句拆分，防止VAD把跨镜头台词合并后错配。缺失台词、额外语音、识别差异、低置信度均供复核，不自动改写台词。
- 无语音结果照样逐句标出缺失，不当作“全部通过”。源码不可读不影响音频文件审核。
- DONE表示转写任务完成，仍为REQUIRES_CONTENT_REVIEW，不代表配音情绪、音质、口型或剧情通过。

## 本机安装

本机已经配置 `backend-node/data/local-asr/venv` 与 `model`，都被Git忽略。其他机器可按下面步骤显式安装；这是环境安装，不会上传项目音视频。

```sh
python3 -m venv backend-node/data/local-asr/venv
backend-node/data/local-asr/venv/bin/pip install -r backend-node/requirements-asr.txt
backend-node/data/local-asr/venv/bin/python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download('Systran/faster-whisper-small', local_dir='backend-node/data/local-asr/model', allow_patterns=['config.json', 'model.bin', 'tokenizer.json', 'vocabulary.*'])
PY
```

运行时使用local_files_only并设置HF_HUB_OFFLINE，关闭ONNX遥测。支持在可信本机config.yaml中用local_asr.python/local_asr.model指定绝对路径；HTTP不允许客户端指定可执行程序或模型路径。

## 接口

`POST /api/v1/agent/runs/:id/chatcut/:jobId/audio-review`，正文`{"retry":false}`，立即返回任务状态。失败或中断后显式传retry=true。运行详情中的editing_jobs[].audio_review返回状态与结果；只接受本机与本地Origin。

语音结果包括按句对照、未匹配语音、对齐缺口和完整分段。工作台可展开查看、点击秒数定位播放。缺少配置会明确报错，不偷偷使用付费供应商。

## 2026-09-21 验证

- 持久化队列：重复提交一次执行、失败需显式重试、重启中断、运行中文件篡改失效、静音和裁切不沿用完整台词、额外语音提示、VAD跨句对齐均有回归测试。
- 真实本地ASR联调：2秒色块/提示音样本最初触发低置信度幻觉识别，启用VAD后segments为空，预期台词标为缺失。
- 80秒真实成片VAD回归：16条旁白都有对应证据，0缺失、0未匹配时段。汉字同音/数字转换差异仍保留，不据此判定配音有错。
- 浏览器：隔离5686工作台轮询完成、展开逐句对照、点击定位后视频播放，截图/tmp/drama-audio-queue-ui.png。

核心文件：localAudioReviewJobs.js、audioTranscriptReview.js、scripts/transcribe-local.py、迁移30、AgentWorkbench.vue。可选ASR脚本及MCP传输脚本已明确排除在历史scripts目录忽略规则之外，避免交付遗漏。
