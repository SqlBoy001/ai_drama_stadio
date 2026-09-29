# ChatCut v3 字幕与剧情浮层迁移验收

2026-09-21。B3技术迁移通过，B4完整内容复审未完成。未调用付费生成、转录或云导出。

- 工程保持372c5083-8098-4714-812d-dc00d79f9f33；复制v2，新时间线9c99d540-0af8-4e60-b7ee-5199d113c78f，名“今天重来 · 字幕与剧情浮层 v3”。v1/v2保留。
- 原文来源backend-node/data/production/今天重来-v02/EP01/subtitles.v02.ass，31项：16旁白字幕、14剧情提示、1内部标识。以三种可编辑Motion Graphic组件和31独立片段迁移，不是压平字幕视频，不是原生Caption Card。没有伪造转录数据；原生字幕导出仍不能据此宣称支持。
- 采用已由search_fonts返回的Noto Sans SC，替换原ASS系统字体Heiti SC；保留白色底部旁白、上方半透明黑底提示与内部标识布局。保持原字幕的整句/镜头时段，不宣称逐字对齐；第13镜旁白字幕从60.0改为60.6秒，与已有返修音轨一致，结束65秒不变。
- 回读31项的有效文字（资产默认值+片段覆盖值）与迁移清单逐条相等。时间线为16视频+16旁白+31文字片段；80秒未改变；32个源文件SHA256未改变。
- 查看11个关键时间点的Desktop合成预览；文字可见，未遮挡这些抽样画面中的人物面部。实际导出2秒帧再次核验文字存在且可读，不以预览代替导出验证。尚未完成逐镜完整动作与主观声音验收。

## 导出与测试

原生导出任务b01b2688-0f4a-42f8-ab5c-4482b6498b37。

文件：/Users/shenzihao/Movies/ChatCut/ai-drama-chatcut-20260921-v3.mp4。
80.000秒、720×1280；完整FFmpeg解码exit0，日志为空。SHA256：727a14bf356dfce1a64048f3ac70e651aa05c81e0fa01cb255b96878ce1a2c48。
解码为PCM后v2与v3音轨SHA256一致，证明此次文字迁移未改声音，不是主观音质认证。

全回归：167后端、19前端、JS语法、Vue构建、隔离启动/HTTP冒烟通过；没有独立typecheck。日志/tmp/chatcut-v3-verify.log。未修改业务源码或生产数据库。
证据在backend-node/data/acceptance/chatcut-20260921/：text-cues-v3.json、text-migration-result.jsonl、v3-preview.jsonl、v3-text-items.jsonl、v3-export-task.jsonl、v3-export-probe.json、v3-decode.log、v3-export-frame.jpg、v3-validation.json、v3-audio-compare.json。

## 错误及修复

- 当前会话未暴露ChatCut工具目录；读取应用已注册命令，通过官方stdio MCP initialize/get_active_project/get_guidelines/execute操作，未猜端口或修改配置。实际工具确认了正确工程。
- 字体工具初次缺projectId；按返回提示显式传原工程ID后成功。
- MG初稿被validator拒绝；按官方Component示例精简并使用props写法后校验通过（未将具体根因过度归结为某一个语法）。
- 首次字幕被视频层遮挡；读取真实属性，试调order=10被范围验证拒绝，改合法层序并实际预览成功。最终原视频在前，文字轨在后叠加。
- 初次文字核对脚本将所有组件默认值误按旁白处理，Info/Internal断言失败；修正为各自资产默认值，31条全部相等，未改内容掩盖错误。

## 下一步

B4完整内容复审：保留第5镜设备与剧情等旧WARN，建立时间码问题清单，区分剪辑可修与需要新素材的问题；不重复购买媒体。C1/C2真实批准链映射与导出回传仍未实现，本次样片不替代工作台批准记录。
