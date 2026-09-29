---
production_version: v02
generated_at: 2026-09-21T09:54:00Z
source_versions: [EP01/storyboard:v02, independent-image-review:v3]
supersedes: null
status: human_review
---
# 《别开第二次门》新素材阶段验收

|Gate|Status|Evidence|Affected IDs|Required action|
|---|---|---|---|---|
|Timing|PASS|3×5秒；三句短台词|全片|实音复核|
|Opening conflict|PASS|手机中的未来自己警告；独立剧本审核|S001|视频验证呈现|
|Mid escalation|PASS|主动反锁作为选择|S002|核验反锁动态|
|Final hook|PASS|手机熄灭后声音来自身后|S003|音轨来源与反应核验|
|Dialogue pace|PASS|每句估算小于4秒|全片|实际音频仍未生成|
|Character identity|PASS|新定妆与三张修正版实际像素核对|全片|动态身份待审|
|Costume/hair/age|PASS|黄卫衣、黑短发、单女性保持|全片|视频待审|
|Spatial continuity|WARN|门关闭与暖灯方向稳定；手机左右手不一致|S001→S002|两轮修正后人工选择明确换手动作或暂停修图|
|First/last frame handoff|PENDING|没有实际视频|全片|动态核验|
|Prompt lock coverage|WARN|生产参数与结构字段已统一；硬编码UI误注入已修复|全片|保留日志回归|
|Copyright/platform risk|PASS|本轮原创2D动画；不复用外部剧情或旧片|全片|保持原始素材记录|
|Assembly preflight|PENDING|视频尚未购买|全片|不得提前宣称成片通过|

## 证据与发现
- 新建隔离数据库、真实Seed2mini剧本与资产提取、Seedream4.5新图；不是旧素材回放。run=12562371-c348-4717-b9b3-250c8dcf85d3，工作台5689。
- 角色提取最初丢失上游黄卫衣短发约束，已修复代码并回归。
- 场景首版多扇开门，改写清楚空间合同后生成闭门场景。
- 通用“手机+警告+表情”检测错误添加最高优先级手机UI，产生透明框。已改为明确可见屏幕内容才触发；真实局部修图移除框线。
- 首帧S002的两次局部修正保留版本5→8→11。最终旋钮可见、门关闭，但手机持手与第一镜不一致；独立视觉复审再次提出。没有隐藏失败记录或继续自动买图。
- 独立审核也存在误判：曾将闭门判成开门、漏检透明框。主Agent通过实际像素检查交叉纠正，不能将小模型审核当绝对事实。
- 提议第一镜结尾显式将手机换至左手、右手腾出反锁；等待用户按两轮转人工规则判断。尚未购买视频、生成语音、ChatCut合成或成片验收。

## 保留与费用
原图、候选图、生成任务、旧审核全保留；当前采用image10/11/12。手机参考image9。
预算文件data/production/do-not-open-v01/budget-ledger.json，当前累计预留7.50元（不是供应商账单）；视频预留3元/5秒，剩余12.50元。失败不退款式释放预留，网关硬限制总20元。
独立审核及SHA证据：同目录independent-image-review-v2.json、independent-image-review-v3.json。

## 发布结论
未通过最终成片验收。图片阶段有具体手部连续性决策待人工；不生成带已知缺陷的昂贵视频，不将技术测试通过表述为作品质量通过。
