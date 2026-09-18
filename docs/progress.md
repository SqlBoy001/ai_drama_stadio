# 连续开发闭环进度

## 执行约定（2026-09-17 起）
- 每次修改前读取本文件、根目录 progress.md / findings.md / task_plan.md、相关报错日志和 git diff（含暂存区），沿用已验证结论。
- 一次解决一个可验证子问题；记录验收条件，修改后执行启动、静态检查、单测和适用的冒烟测试。
- 当前为纯 JavaScript，未配置 TypeScript/typecheck；使用 Node 语法检查与 Vue 生产构建，不将其称为类型检查通过。
- 失败先读完整日志、定位原因；未解决时至少尝试两种安全方案后再提问；非关键错误单独记录并继续。
- 最新授权：允许少量付费连通性/效果测试，优先 Mock 回归；限定请求数并记录成本，不批量生产。Mock 使用隔离数据库与无凭据配置，避免恢复生产任务。
- 每个模块更新：已完成、当前报错、下一步命令、关键文件。测试未通过不得标记完成。
- 保留现有未提交业务改动，不覆盖、不回滚、仅在用户授权时提交（本轮已授权 GitHub 提交）。

## 当前模块：框架与设计目标扫描
状态：扫描与基线验证完成；未新增业务功能。

已完成：读取既有阶段 0—12 记录、历史报错、架构/画布设计、待办、当前变更及核心编排代码。识别 Mock 状态导出与真实媒体导出的差别。

当前报错：无阻塞性失败。首次隔离 HTTP 启动遇到沙箱 listen EPERM，读取完整日志后，使用本机监听权限重试成功。Vite 存在超过 500 kB 的包体积警告，不影响构建。扫描中误读 utils/response.js，文件检索后定位到 backend-node/src/response.js；不涉及产品故障。

验证结果：
- Node 22.17.1 / SQLite ABI 127 启动自检通过。
- 后端 110/110、前端 13/13 单测通过。
- 139 个 JavaScript 文件 node --check 通过；Vue/Vite 构建成功。未配置类型检查，不记为 typecheck 通过。
- 实际 createApp 启动，内存 SQLite 自动迁移，无供应商凭据；HTTP /health、工作台页面响应与三次审核通过，6 条模拟用量、6 条模拟质检，最终 EXPORTED。仅验证状态闭环，不代表 MP4 产物验收。
- git diff --check 通过。未调用真实模型，未修改生产数据库；测试服务已退出。
- 完整本轮日志和临时 HTTP 脚本位于 /tmp/ai-drama-scan-20260917/（临时目录不保证长期保留）。

下一步命令（先读取再修改）：
```sh
cat docs/progress.md task_plan.md progress.md findings.md
git diff --stat
git diff
git diff --cached
sed -n '245,335p' backend-node/src/services/agentWorkbenchService.js
```
下一可验证子问题：Mock 本地媒体生成与导出 MP4，测试需断言文件存在、ffprobe 时长/尺寸及零付费调用。该项尚未实施。

关键文件：backend-node/src/services/agentWorkbenchService.js、agentProductionService.js、backend-node/src/app.js、frontweb/src/views/AgentWorkbench.vue、FilmCreate.vue、docs/project-framework-and-goals.md。

## Git 标准化（完成，已推送 main）
- 目标仓库已有 main 的初始 README；采用保留该提交的当前源码快照，不覆盖远端历史，保留原 MIT 许可及来源。
- 添加 Node 22、根目录统一 setup/check/test/build/smoke/verify 命令及 CI；本地数据库、凭据、测试截图与 macOS FFmpeg 不入库。
- 当前报错：Docker daemon 未运行，暂未从 Docker 找到代理；继续查本地进程/配置。此项不阻塞 Git 或自动创作开发。
- 下一步命令：npm run verify；扫描暂存区敏感值后提交。
- 关键文件：package.json、scripts/、.github/workflows/ci.yml、.gitignore。

- 基线验证：后端 110/110、前端 13/13、JS 检查与构建通过；HTTP 冒烟首次沙箱 EPERM，授予本机监听权限后通过。无付费调用。

## auto：引导式导演入口（本轮验证完成）
- main 已推送：92e2e90；当前分支 auto。目标仓库初始提交保留；原上游保留为 upstream，原工作分支保留。
- 新增持久化导演草稿：一句话、最多三个方向问题、推荐选项、补充意见、单集时长/预算；默认 Mock。
- 真实策划调用既有文本客户端，每次至多一个请求，1800 输出 token 上限；缓存方案，修改使旧方案失效；生产仅接受服务器保存的最新方案，重复确认不重复建任务。
- 开放式需求理解仍由后续文本策划负责；前置澄清问题目前是明确标识的结构化向导，不宣称全自主导演。
- 纠正质检固定100分，显示最新素材记录的真实 PASS/WARN，并说明技术检查不等于内容验收。
- 定向后端5项通过，前端构建通过；下一步 npm run verify 与隔离浏览器验收。
- 关键文件：directorService.js、routes/director.js、25_director_sessions.sql、DirectorCreate.vue、qcSummary.js。
- 真实文本小样：仅 1 次既有 DeepSeek 默认配置请求（1800 输出 token 上限）返回 READY，保留黄外套/无血腥/逃出幻觉的需求；图片/视频/TTS 请求为 0，文本实付金额需供应商账单核对。
- 浏览器已验证桌面与 390px 手机方案、刷新恢复、修改意见、推荐选项；axe 0 确定违规（2处对比度待人工检查）。
- 补充失败回归发现预览角色锚点未进入后续 premise，已把已确认角色与外观一并传入；回归通过。
- 代理诊断：本机 AIClient2API 已定位，零网络方法复现 gpt-image-2 → gpt-5.4；历史日志证实账号不支持该上游型号。详情见 docs/image-provider-notes.md，不以开通 Pro 作为保证能修复的建议。

- 浏览器途中重新构建导致旧页面引用已删除的 hash chunk，表现为动态模块加载失败；定位日志后刷新加载新构建即可恢复，已创建任务由幂等确认复用。
- 首页改为 /create 后同步旧制作页“返回项目库”到 /projects，一键启动也指向新入口。


## 本轮交付（2026-09-17）
- 已完成：main 源码基线、统一验证命令/CI、auto 引导式入口、持久化方案/版本/幂等确认、真实文本策划接入、角色约束传递、准确的质检展示、GPT Image 2 代理诊断。
- 验证：`npm run verify` 通过；后端 115/115、前端 16/16、145 个 JS 文件语法检查、Vite 构建、HTTP Mock 全链路。浏览器新建→推荐选项→方案→指定任务→三次审核→EXPORTED 全程通过；另验收修改与刷新恢复、390px布局。Mock EXPORTED 仍仅为状态，不表示 MP4 文件。
- 真实测试：1 次文本策划；0 次图片/视频/TTS。未验证本轮真实媒体整片质量。官方 OpenAI 图像 API 无已验证凭据；代理故障已定位但未改动代理或声称修复。
- 当前报错：无本轮阻塞错误；Vite 大包告警保留；GitHub 对继承的 94.67MB Windows FFmpeg 给出体积警告，推送成功。后续可独立迁移二进制发布策略。
- 本地服务已重启，`/health` 与 `/create` HTTP 200；重启前已确认没有运行中媒体任务，SQLite 备份保存在忽略目录 `backend-node/data/before-auto-20260917.db`。
- 下一步命令：`git status --short`、`cat docs/progress.md`、`npm run verify`。
- 下一单一子问题：让素材/视频修改意见形成可验证的局部修改计划，并用已有素材进行内容评审；不要将字段完整性当成视听质量。
- 明确边界：前置问题为结构化向导，真实模型负责方案创作；尚未实现自由对话式追问、视觉内容自动判定/修复或直接长视频路由。Mock 可播放产物仍是后续待办。
- 关键文件：`backend-node/src/services/directorService.js`、`backend-node/src/routes/director.js`、`frontweb/src/views/DirectorCreate.vue`、`frontweb/src/utils/qcSummary.js`、`scripts/smoke.cjs`、`docs/image-provider-notes.md`。

## 高级制作页返回 AI（2026-09-17）
- 已完成：制作页顶部增加 AI 导航提示及“返回 AI 任务，审核并继续”，按当前项目匹配任务；无关联任务时明确提供新创作入口，加载失败可重试，路由切换防止旧请求覆盖。
- 验证：Node 22 下 npm run verify 全部通过（后端115、前端16、145文件语法检查、Vue构建、隔离HTTP启动/Mock冒烟）。浏览器实测 film/4?episode=8 返回对应任务 e0b919c2-0046-451c-8ab1-71bd9d572224，显示剧本审核且无浏览器错误；未点击审核或媒体生成，付费调用0。
- 当前报错：首次误用系统Node导致SQLite ABI不符，完整日志确认后切回项目Node22解决；保留原Vite大包警告。无类型检查配置，不宣称类型检查通过。
- 下一步命令：export PATH=/Users/shenzihao/.nvm/versions/node/v22.17.1/bin:$PATH；npm run verify。
- 关键文件：frontweb/src/views/FilmCreate.vue。此修改解决返回入口与操作说明，尚未重构高级制作页全部控件。

## 本地访问恢复（2026-09-17）
- 原因证据：5679 无监听进程，curl /health 报连接失败；没有上一进程退出日志，具体退出原因未确认。
- 已完成：使用现有启动脚本、Node22，以独立后台进程恢复服务，日志 /tmp/ai-drama-server.log；启动前确认无进行中视频任务。
- 验证：SQLite ABI 自检、实际服务启动、/health 与用户工作台 URL HTTP200。未修改业务代码，未重复全量单测/构建；项目无类型检查脚本。付费请求0。
- 当前报错：无阻塞错误。下一步命令：curl -fsS http://localhost:5679/health；必要时查看 /tmp/ai-drama-server.log。
- 关键文件：start_app.command、backend-node/src/server.js；本次仅追加进度记录。

## 分阶段人工审核与媒体诊断（2026-09-18）
- 已完成：高级制作页取消三个自动倒计时，改为显式审核后进入参考图/分镜图/视频；补全缺失入口视频前也等待审核。停止、离开页面、切换项目/集取消待审核关卡；修正Mock任务与高级页真实调用混用的提示。
- 已查明：第9镜传入李默及画外主管两张人物参考，实际成图角色动作串位且分屏；4段视频抽帧存在眼镜新增、重复人物、另一组男女人物等偏差。详见 docs/media-quality-audit-20260918.md。尚未修复模型输出或完成统一服务端分阶段工作流。
- 验证：npm run verify通过，后端115、前端18（新增显式确认/时间不放行/取消/重复点击回归），JS语法检查、Vue构建、隔离启动与HTTP Mock冒烟均通过。无独立类型检查脚本。浏览器制作页可加载、无运行时错误；未在生产点击生成进行门禁测试。
- 当前报错：无阻塞失败；原Vite大包告警保留。浏览器工具一次自动审批超时，重试成功。现有媒体质量问题保留待局部修复，0次新增付费请求。
- 下一步命令：先读取本报告与git diff；检查第9镜的可见人物与画外音区分，再对单镜参考绑定增加回归；不要整集重生。
- 关键文件：frontweb/src/views/FilmCreate.vue、frontweb/src/utils/pipelineReview.js、frontweb/test/pipelineReview.test.js。

## 首帧丢失根因与画外角色修复（2026-09-18）
- 已完成：复现视频服务reference列表非空就删除首帧，经典协议最终发t2v的缺陷；保留帧参数，并拒绝reference-only静默降级及不可读本地帧。补充中文编码本地路径的出站body回归。
- 已完成：明确纯音频角色从图像参考筛选和服装锁中一致排除；旧缓存锁更新后不保留画外角色。保守规则不声称解决所有自然语言歧义。
- 验证：根因回归先失败后通过；完整verify通过（后端121、前端18、JS语法、Vue构建、隔离HTTP启动/Mock冒烟）。无独立类型检查。原服务无运行中媒体后已重启加载修复。
- 当前阻塞：自动审批拒绝将现有会议室素材发给Volcengine Seedance2.5做单次真实视频验证，理由为具体素材/目的地外发尚缺明确授权；未发请求，费用0。不能宣称真实画面质量验收完成。
- 下一步：授权后限定1次5秒480p小样，核对实际出站i2v、返回视频人物/场景/动作和供应商费用；未通过不得通知整体验收。继续统一质量门禁与版本化局部修复。
- 关键文件：backend-node/src/services/videoService.js、videoClient.js、shotPresence.js、characterContinuityService.js、imageService.js；对应回归见backend-node/test。

## 用户授权后的单次真实视频验证（2026-09-18）
- 授权范围：用户明确允许项目4会议室首帧/原视频24提示词发往火山doubao-seedance-2-5-260628；最多1次5秒480p、5元内、不重试。
- 价格核实：官方 https://docs.volcengine.com/docs/ark/model-pricing?lang=zh 当日页面，480p/720p不含视频输入70元/百万token；5秒480p示例3.36元，预估在预算内。项目硬编码成本估算不是供应商价格依据。
- 执行：仅创建视频25，未绑定storyboard_id、不覆盖原分镜/视频；新增生成提交1次。真实日志确认task_type=i2v、has_first_frame=true、frame_count=1。
- 当前报错：供应商HTTP400，input image content[1] may contain real person。记录状态failed，无视频产物；不自动重试、不规避供应商限制。
- 费用：提交前估算约3.36元；未取得供应商账单或计费用量，不宣称已实扣或实付0元。
- 验证边界：真实请求首帧传输通过，真实输出视听质量未通过验收（未产出）。此次未改业务源码，不重复全量测试。
- 下一步：处理供应商能力/内容限制的清晰错误展示，并继续离线质量门禁工作；真实画面验收需使用供应商明确支持且获授权的素材方案。
- 关键文件：docs/media-quality-audit-20260918.md；临时日志/tmp/ai-drama-server-quality.log（不提交，含供应商请求信息）。

## 官方预置虚拟角色接入准备（2026-09-18）
- 已完成：官方文档核实Seedance2.0/2.5支持预置虚拟人像asset URI；新增独立official_avatar字段，不覆盖自生成角色图或已有认证资产。角色卡可绑定来自官方库的ID，状态明确为selected_unverified。
- 已完成：单镜零费用方案接口按本项目出镜角色构建有序资产引用/人物提示词，缺绑定返回BLOCKED，明确画外音角色不要求绑定；经典火山Seedance2.x的纯官方asset列表走reference_image请求，未静默转文生视频。
- API：PUT /api/v1/characters/:id/official-avatar；GET /api/v1/storyboards/:id/official-avatar-plan。后者只检查与预览，不发起生成；既有普通生成按钮未自动改用官方角色。
- 验证：完整verify通过，后端124/124、前端18/18、JS语法、Vue构建、隔离HTTP启动与Mock冒烟。无独立类型检查脚本。生产已备份SQLite并重启；浏览器看到绑定/检查按钮、无运行时错误；第64镜只阻塞缺失李默绑定。
- 当前阻塞：可访问的火山浏览器会话未登录；首次人像库需用户接受协议并在本人账号内选择资产。尚无真实asset ID，不能验证账号可用性或官方角色成片质量。不要把手填ID当成认证成功。
- 付费调用0；未使用官方示例ID冒充用户选角。原素材保留。下一步：用户登录选角后绑定两位角色，基于明确模型/预算生成单镜小样，再继续图像/视频质量验收。官方资产参考路线不继承原自生成写实首帧，界面已明确提示。
- 关键文件：officialAvatarService.js、26_official_avatar.sql、routes/characters.js、videoClient.js、FilmCreate.vue；临时日志/tmp/drama-avatar-verify.log。
- 官方来源：https://docs.volcengine.com/docs/ark/avatar-library?lang=zh 与 https://docs.volcengine.com/docs/ark/seedance-portrait-asset-guide?lang=zh#preset-avatar。
