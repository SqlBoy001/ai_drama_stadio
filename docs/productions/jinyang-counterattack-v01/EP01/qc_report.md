---
production_version: v01
generated_at: 2026-09-26T05:08:48.791496+00:00
source_versions: [用户授权章节, 已确认60秒内容结构]
supersedes: null
status: text_and_mock
---

# 制作资料审核
|Gate|Status|Evidence|Affected IDs|Required action|
|---|---|---|---|---|
|Timing|PASS|10镜连续60秒，每镜5—7秒|全片|真实输出后复测|
|Opening conflict|PASS|0.2秒开始出卖对白|S001|检查表演与首帧|
|Mid escalation|PASS|阻拦失败与近身夺刃|S004—S007|检查动作|
|Final hook|PASS|54.5秒起发出反击邀请|S010|检查情绪与结尾|
|Dialogue pace|PASS|4字/秒+停顿，区间不重叠|全片|TTS后重新测量|
|Character identity|PENDING|尚未生成|全片|审核参考图|
|Costume/hair/age|PENDING|文字锁已明确，实际图未生成|全片|非性化年龄核验|
|Spatial continuity|WARN|同轴文字设计完成|S006—S009|近身夺刃、抽刀先单独验证|
|First/last frame handoff|PENDING|状态已定义，图片未生成|全片|逐镜比较|
|Prompt lock coverage|PASS|四处逐字角色锁|全片|机器校验|
|Copyright/platform risk|WARN|用户确认授权；已删除性暴力表达|全片|发布前核对具体平台授权范围|
|Assembly preflight|PENDING|没有真实媒体|全片|不得放行合成|
|Multi-speaker TTS|BLOCKED|当前工作台只支持单说话者镜头|S003|使用独立分轨流程或实现多说话者支持|

## 修正与风险
已补匕首来源、落地及抽刀手别；没有复制参考视频人物。静帧记忆插入由剪辑实现；新增服装等为制作设定。自动格式校验不代表画面及声音验收。
## 局部重跑与保留
新项目，保留全部旧项目和旧素材；本次没有失效的既有下游。若角色锁改动，仅使对应角色镜头失效。
## 发布决定
文本制作包可审阅；真实媒体与发布未放行。付费供应商、模型、范围、预算尚未为本项目确认，所有任务mock，无实际请求。
