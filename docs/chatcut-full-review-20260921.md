# 全片检查与切点修复

本轮交付是80秒既有内部样片的审核与局部修复，不是120秒新剧制作验收。新增付费调用0。

## 可复核结果

- v5全80秒解码与信号扫描定位3个单帧黑画面：4.9667、69.9667、74.9667秒。相邻帧截图确认画面变黑、字幕仍存在。
- 保留v5、复制v6时间线 `ede55d29-38f8-4799-aefd-a653ffd93f8d`。3个片尾各裁掉1帧并补同源尾帧，音轨和字幕保留。工具validateOnly最初拒绝fromItemId与type并用，移除type后成功；未重复创建时间线。
- v6原生导出原3处修好，但39.9667、54.9667秒出现新的单帧黑画面。源视频实测24fps/121帧/5.041667秒，不能归因于原文件不足5秒。当前证据提示原生导出存在不稳定切点，未确定内部实现根因。
- v7使用本地FFmpeg只替换v6的1199、1649帧，取各自上一帧。重新全片扫描没有黑场、没有>=1秒冻结，80秒；音频PCM与v6完全一致。此版本是后处理输出，不冒充ChatCut直接原生导出；视频重新编码，音频stream copy。
- v5/v6/v7声音相同。临时本地faster-whisper small转写整80秒，16条旁白全部有匹配时段。8条去标点逐字相同；其他包含同音字、代词和数字转换，不直接判定配音错误。转写无提示词注入预期台词，没有将字幕假冒识别结果。
- 每5秒一镜的旁白后普遍有1.4–2.5秒静音，16个区间；可能影响节奏，不能自动裁掉可能承载表演的画面。原稿65–80秒转折仍依赖说明文字，未由本轮黑帧修复解决。

## 实现

`chatcutLayerEvidence.js`将共享模板默认值、可读源码摘要和实例参数纳入版本。当前Desktop外部MCP没有代理工作区，includeCodeFile明确失败；普通inspect_asset的MG html为空。实际63项回读得到3个模板，缺口被保存，不能自动通过。原生字幕只读响应已保存接口支持；分页完整性没有正例实测，因此仍明确不完整，不宣称已全面支持。

`finalCutInspection.js`在实际导出回传时完整扫描视频/音轨，生成冻结、黑场、静音区间。工作台显示结果与图层缺口。`audioTranscriptReview.js`按成片SHA256绑定机器转写、逐行时间与文本对比；`transcribe-local.py`只接受本地模型目录，没有付费API或自动模型下载。转写当前为显式本地CLI，尚未作为后台自动任务接入。

## 验证与文件

162个JS语法检查、184后端单测、19前端单测、Vue构建、隔离启动HTTP冒烟通过。没有独立typecheck。日志 `/tmp/chatcut-audio-final-verify.log`。

证据目录 `backend-node/data/acceptance/chatcut-20260921/`：

- `v5-layer-evidence.json` / `v6-layer-evidence.json`
- `v5-full-transcript.json` / `v5-audio-text-review.json`
- `v5-full-signal-review.json` / `v6-full-signal-review.json`
- `v7-validation.json` / `ai-drama-v7-cut-repair.mp4`

模型和虚拟环境在临时目录，不加入项目运行依赖或Git：

```sh
/tmp/ai-drama-audio-review-venv/bin/python backend-node/scripts/transcribe-local.py MEDIA --model /tmp/ai-drama-whisper-small --output NEW_EVIDENCE.json
```

## 未解决的实际边界

机器转写和全帧信号检测提供全时间覆盖，但不是人类听觉审美、逐帧身份/肢体动作的语义认证。现有执行接口没有直接视听理解工具；未把没有执行的听审记为通过。Desktop MG源码访问仍缺内部工作区，界面读取本轮卡住并被中断。可继续独立开发本地转写任务接入、字幕密度/遮挡检查和两轮修正状态流；不需要重新生成全剧。

## 文件验收范围修正

后续已解除“源码不可读→禁止人工验收文件”的过度限制。文件审核绑定已检查的导出文件SHA，scope=EXPORTED_FILE_ONLY；源码证据缺口单独保留，不认定工程模板通过，不自动批准真实成片。185+19全回归及构建/启动通过。此前本报告提及的“缺源码不能通过”，仅适用于工程源码完整性证明，不再阻塞特定文件的人工内容验收。
