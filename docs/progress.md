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

## 官方库选角与本地绑定（2026-09-18）
- 已完成：用户登录 agent-browser 的 drama-casting 可见 Chrome 后，进入 Seedance2.5 虚拟人像库，按实际图片核对后绑定项目4的两个独立角色。李默（11）：asset-20260720212511-gppkb，黑短发、年轻、深色西装白衬衫；主管（12）：asset-20260311092315-88xts，短寸发、浅蓝衬衫。官方职业标签仅用于检索，不替换本地剧情身份。
- 原人物图、旧分镜和视频保留；绑定状态仍为 selected_unverified，未把选角成功当作供应商验证成功。浏览器“生成并复制asset URI”按钮已点击，但系统剪贴板未取得可验证URI；绑定依据是详情页显示的真实asset ID。
- 验证：服务 /health 正常；两个 PUT 返回成功；第59镜方案按李默/主管顺序引用两个不同ID，第64镜只引用李默、排除画外主管，均 READY_FOR_PROVIDER_CHECK；官方绑定定向测试2/2通过。此次无业务源码改动，未重复构建或重启，无独立类型检查脚本。
- 当前报错：浏览器连接已恢复；沙箱内 localhost 连接失败，经本机网络权限检查确认服务正常。供应商资产可用性与实际成片质量尚未验证。新增付费媒体请求0。
- 下一步命令：GET /api/v1/storyboards/59/official-avatar-plan；在下一次有界真实小样前审查提示词、角色服装和构图约束，不能直接批量重生。旧单次付费测试授权已执行，不自动重试旧失败请求。
- 关键文件：backend-node/src/services/officialAvatarService.js、backend-node/test/officialAvatarService.test.js；绑定保存在忽略的本地SQLite；临时验证日志 /tmp/drama-casting-test.log。

## 80秒制作授权与资产服务阻塞（2026-09-18）
- 用户明确选择：火山Seedance2.5、现有约80秒、总上限60元，预算不足暂停；先5秒480p小样，失败不自动重试。
- 已完成预检：整理对白超时、第68镜“主管字迹”误计出镜、正文悬念结尾与原完整收尾要求冲突、屏幕文字应后期叠加等问题；见 docs/production-preflight-20260918-v01.md。原剧本/分镜未覆盖。
- 小样：新增video26，单次提交，双官方资产参考、5秒480p9:16，不绑定原分镜、不覆盖旧素材。官方当日价格70元/百万token，5秒480p示例3.36元；实际计费未取得，不宣称0元。
- 完整日志确认HTTP400原因：Your account has not activated the Asset Service。API最终正确传递两条asset://，未产出视频、未自动重试。另有资产被错误尝试图床本地路径的WARN，但最终请求体保留正确URI，不是本次400根因，后续独立修复。
- 已检查两条安全路径：核对出站请求/错误日志；通过官方错误指向入口进入开通管理，打开素材资产功能使用规则。规则明确官方预置参考素材及生成内容仅限模型体验与内部使用；尚未勾选或开通，已询问用户是否接受内部样片用途并允许开通后重测一次。
- 验证：真实HTTP请求与查询完成；无新业务代码，不重跑全量构建。读取分镜时误查shot_number报SQL错误，读取PRAGMA确认实际字段storyboard_number后成功；无生产数据损坏。
- 下一步：用户确认用途与开通后再进行一次小样；若目标对外发布，停止使用预置虚拟人像路线，改用有相应权利的素材方案。60元上限继续有效，勿默认为无限重试。
- 关键文件：docs/production-preflight-20260918-v01.md；视频26及task 6aa1c18a-f332-4736-a44e-add65f7f4c99在本地数据库；日志/tmp/ai-drama-avatars-server.log。

## 内部样片正式生产（2026-09-18，进行中）
- 用户已明确允许接受素材资产规则、开通服务并在原60元上限内重测一次；用途限定内部验收。浏览器完成同意并出现“管理素材资产”。
- video27重测成功：真实官方双角色、5秒，供应商返回resolution=480p、48437 tokens，按70元/百万token计算3.39059元。下载文件实际1440×2560、24fps、5.056秒；不能仅用文件尺寸推断计费档位。抽帧确认主角站立推纸、主管坐着、身份未互换。
- 已按用户授权继续16镜80秒，受控并发3，每提交预留3.5元、另为video26失败预留3.5元，总预留上限59.5元，不自动重试。具体任务清单与费用见忽略目录 backend-node/data/production/今天重来-v02/。
- 制作修正：通知书明确为拟辞退；主管字迹不计出镜；审计组用画外信息避免新增人物；结尾主动提交证据；准确中文本地字幕，不要求模型绘字。第5镜设备像扫描仪，未通过原碎纸动作要求，已改为收走方案/禁止直联客户的叙事，不冒称原效果通过。
- 音频：本机Tingting旁白，未使用付费TTS。首次沙箱say生成空音轨，ffprobe确认零时长；授权本地系统服务访问后有效，16段实际2.6–3.7秒，适配每镜5秒。采用统一旁白音轨，避免生成原音不同音乐/语音混杂。
- 当前状态：12镜生成完成并抽帧检查，第13至15镜制作中；尚未全片合成验收。新业务代码未修改，媒体和字幕逐项验证中。
- 下一步命令：python3 /tmp/drama_production_v02.py status；python3 /tmp/drama_cost_v02.py；逐镜抽帧后生成第16镜，完整合成并执行解码/时长/字幕检查。执行脚本在/tmp，交付前复制到本地制作包留档。

## 《今天重来》80秒内部样片输出（2026-09-18）
- 已完成：16/16新视频（27–42），官方两角色参考；新版本脚本/分镜、16段本地旁白、中文信息字幕、720×1280合成。输出 backend-node/data/production/今天重来-v02/今天重来-v02-内部验收.mp4；仅内部体验，不对外发布或商用。
- 验证：逐镜1fps抽帧检查身份/服装/核心动作，完整合成视频FFmpeg解码exit0、错误日志0字节；ffprobe为80.014秒、H264、24fps、AAC 48kHz mono、约16.4MB。字幕0–80秒，单段旁白2.6–3.7秒，试渲染及16镜整片缩略图核对通过。未做逐帧人工检查或听觉主观评分，质量结论为内部样片PASS_WITH_WARNINGS，不是商业发布验收。
- 费用：成功用量774992 tokens，按官方70元/百万tokens折算54.24944元；失败video26计费尚待账单确认，另预留3.5元；合计预留57.74944元，小于60元。没有付费TTS，没有自动失败重试，没有后续付费任务。
- 产品验证：episode8仅更新合成video_url到新的static exports地址，原值记录episode-before-export.json；旧剧本/分镜/角色图/旧视频不覆盖。浏览器film/4?episode=8的新成片readyState4，duration80.013，实际播放推进到22.67秒无播放器错误。旧分镜卡仍是旧版本，不能据此再次自动合成覆盖新版。
- 当前限制：第5镜道具未达到原碎纸机动作要求，改为“收走方案/禁止直接联系客户”完成叙事；跨镜布景有细节变化，本版以统一本地旁白为音轨，不是角色对口型配音。没有把这次人工编导/检查宣称成工作台已全自动解决。
- 本轮未改业务代码，不重启或重复构建；完成媒体/字幕/数据关联的针对性验证。浏览器调试曾重声明const变量，改为IIFE读取后确认播放成功；不影响产品。项目无独立类型检查脚本。
- 下一步命令：查看制作包EP01/qc_report.md、cost-ledger.json；用户可在制作页成片预览或直接打开MP4验收。本轮制作脚本已复制到制作包tools/，不得未经授权追加付费重跑。
- 关键文件：制作包production-manifest.json、EP01/storyboard.json、EP01/script.md、EP01/qc_report.md、EP01/subtitles.v02.ass、cost-ledger.json；媒体和数据库均位于Git忽略目录。

## 动漫小场景：时长契约修复（2026-09-18）
- 新授权：原创动漫《署名交锋》20秒、新增预算30元、最多两次Seedance2.5视频（首版+定向修正），Seedream参考图预留1元。与上一版60元分开计算。已生成image84，原素材保留。
- 根因：normalizeVolcengineDuration把2.5沿用2.0的15秒上限，20秒请求会静默变短。官方 https://docs.volcengine.com/docs/ark/seedance-2-5?lang=zh 确认2.5为4–30秒，现按型号单独处理。
- 验证：npm run verify通过，后端125/125、前端18/18、语法检查、前端构建、隔离HTTP启动与Mock冒烟通过；新增实际出站20秒回归和2.0/1.5边界回归。纯JavaScript，无独立类型检查脚本。日志/tmp/drama-anime-verify.log。
- 生产无活动视频任务，重启加载修复。当前未提交本轮付费视频，参考图视觉审核通过；真实对白/动作质量尚待验证，不宣称成片达标。
- 下一步命令：curl http://localhost:5679/health；提交一次20秒480p小样，完整解码+逐秒抽帧+本地ASR；只在明确缺陷且预算允许时定向修正一次。
- 关键文件：backend-node/src/services/videoClient.js、backend-node/test/volcengineVideoBody.test.js；忽略的制作包backend-node/data/production/署名交锋-anime-v01/。

## 《署名交锋》首版审查与定向修正（2026-09-19）
- video43成功，20.064秒，供应商192550 tokens×70元/百万=13.4785元（折算，非账单实付）。真实请求20秒/480p/i2v，生成原生音轨。完整解码通过，全片1fps和9–12秒4fps抽帧。
- 本地faster-whisper small识别三句原对白：索取署名、本人汇报、客户点名；署/属同音转录差异不冒称发音错误。角色/服装稳定，结尾文件夹回主角侧。但电话接听动作被前景遮挡、手部叠放降低可读性，首版暂不通过，不改故事掩盖缺陷。
- 已用授权内唯一一次定向修正video44：仍20秒480p，同首帧、同对白，镜头调整4/6/4/6秒，新增清楚的手机触屏接听特写，分离双人手部。待供应商完成及检查，剩余授权视频次数0。
- 费用预留：13.4785+14+1=28.4785元，小于新增30元上限；图片84预留1元、账单未核对。没有TTS/API语音识别费用，语音识别完全本地。
- 检查脚本首次未找到PATH中的ffprobe，完整读取日志后改用项目内backend-node/tools/ffmpeg，解码和抽帧成功；首轮ASR因音频尚未生成失败，在提取音频成功后执行通过。非产品错误。
- 下一步：查询/api/v1/videos/44；PATH含项目ffmpeg执行制作包tools/drama_anime_inspect.py v02，再执行本地ASR；对原对白、接听、收回文件夹逐项复核。不得再提交付费视频。
- 关键文件：忽略制作包署名交锋-anime-v01/下video-v01/02-request.json、EP01/qc_report.md、EP01/versions、cost-ledger.json、tools。旧80秒版本及数据库关联不变。

## 动漫小场景两版结果（2026-09-19）
- video44完成，20.064秒，手机接听特写/身份/服装/最终文件夹归属经全片1fps、手机与结尾4fps审查通过；完整解码通过，H264/24fps/AAC32kHz双声道。旧80秒成片未替换。
- 整体未放行：本地ASR全片及截取首句两种解码设置均把“署我的名”转成“属我的命”；无法确定是ASR错误或生成声调不准，保留音频准确性BLOCKED，不用正确字幕覆盖潜在错误。主角对白略快，主观音色/逐帧口型未证实。
- 费用：43和44各192550 tokens，合计385100×70元/百万=26.957元，图片84预留1元，总计27.957元<30元。两次授权视频次数已用完，停止付费，不扩大预算，不新增请求。账单未核对，不宣称实付值。
- 技术结论：修复了明确的15秒上限程序缺陷；独立手机镜头改善了生成动作可读性，说明“提示词长度/生成快慢”并不是单一根因。建议动漫视觉短剧优先探索，但两种不同长度/结构样片不是公平A/B，不能宣称全平台质量保证。
- 关键文件：制作包final-review.json、EP01/versions/qc_report.v02.md、v02/asr.json、v02/asr-firstline-recheck.json、v02/phone-contact.jpg、v02/ending-contact.jpg、cost-ledger.json。下一步仅做独立免费发音复核；不得自动生成第三版。业务修复仍以125后端+18前端和verify全通过为证据，无新增业务修改无需重复全量测试。
- 最终补充：免费本地medium模型独立截取首句复核，仍转录“这份方案属我的命”，疑点未消除，保持BLOCKED；结论见qc_report.v03.md，未要求用户代替测试。浏览器实际播放readyState4、20.064秒、error=null。本地ASR运行生成的:memory:.ses临时文件已移至/tmp留存，不入Git；无额外付费调用。

## 三部两分钟漫剧选稿与首部制作准备（2026-09-19）
- 用户委托选择3个剧本后开始制作。已原创《第七次面试》（悬疑，首推）、《这份方案，谁都带不走》（职场）、《送给三年前的我》（亲情），各含完整120秒剧情、对白、选择/反转、制作风险。不是市场热度预测，未改编外部作品。
- 已开始首部免费制作准备：角色/世界规则、正式压缩拍摄稿、15×8秒分镜、35个Mock任务、制作计划与文本QC。用户委托选稿视为授权编导选择，不追加题材确认。真实媒体付费范围与预算需单独明确，旧60元/30元授权不复用。
- 验证：120秒时间轴无缝覆盖、逐句对白窗口、四类提示词角色锁、35任务依赖/唯一ID、paid dispatch=false检查通过；完整verify后端125/125、前端18/18、JS语法、前端构建、隔离启动与Mock冒烟通过。纯JS无单独类型检查脚本。日志/tmp/drama-pilot-selection-verify.log。
- 当前待办：新预算与制作范围未明确，新增付费0次；角色图/静态预演/视频未生成，其验收仍PENDING。没有把制作文件当作成片，也未修改原生产数据库/旧素材。
- 制作提议：火山Seedream4.5角色场景、Seedance2.5原生720p；先8–16秒关键样片、后分段120秒；单段最多一次修正。建议首部封顶300元或三部顺序总封顶900元，仅为授权上限建议，非报价；真实720p首任务用量核对后重算，不足停止。
- 下一步：预算明确后先图像审核，再静态预演与关键样片；不直接批量生成三片。关键目录docs/productions/pilot-selection-v01/；三稿three-scripts.md，首部interview-seven/production-plan.json、EP01/storyboard.json、EP01/qc_report.md、mock_media_tasks.json。

## 独立剧本审核—修正—人工接管闭环（2026-09-20）
- 已完成：真实剧本生成后独立审核上下文，最多两次修正/三次审核，文本通过自动进入现有资产阶段；不确定/模型或格式异常/修正无变化/额度耗尽转人工。保留原资产、成片人工审核节点，未冒称全媒体审核已完成。
- 新表agent_review_cycles保存合同、初稿/两版修正、证据与调用计数；调用前持久化，唯一键+并发防护防止重复额度；恢复不重试中断调用，已人工编辑的剧本不被旧快照覆盖。人工放行需理由，状态HUMAN_ACCEPTED区别AI的PASSED。
- UI新增独立审核面板，逐版展开剧本、六项检查证据和位置/目标/修正要求；耗尽后“记录人工修改意见”，不再暗示自动重生。Mock不假装语义通过；真实调用0次。
- 验证：后端134/134、前端18/18、JS语法、前端构建、隔离启动和HTTP Mock审核闭环通过。浏览器确认三版和2/2、5/5计数、人工理由弹窗与空值校验。无独立类型检查脚本。日志/tmp/drama-review-release-verify.log。
- 遇到的测试错误：新测试fixture缺少approval_requests.target_type必填值；完整读取失败信息并修正fixture后通过，无生产数据问题。当前无新增阻塞报错。
- 生产：确认无活动图像/视频/Agent任务，备份before-review-loop-20260920.db后重启PID41469；health正常、27号迁移存在、历史run GET兼容、生产review calls=0。日志/tmp/ai-drama-review-server.log。
- 限制：五次调用为硬上限，额外5元仅计划预留，不是供应商实际人民币费用硬封顶；真实文本评审效果及图片/视频内容评审未验证/未接入。参见docs/agent-review-loop.md。
- 下一子问题：先拆分资产/图片/视频边界，再扩展实际素材审核与局部失效依赖；不直接把文本检查当画面审核，不追加付费生成。下一验证命令：PATH=/Users/shenzihao/.nvm/versions/node/v22.17.1/bin:$PATH npm run verify。

## 分镜图片与视频拆分及版本审核门（2026-09-20）
- 已完成：原media步骤拆为IMAGE_GENERATING→IMAGE_REVIEW→MEDIA_GENERATING。资产/分镜方案通过后只生成分镜图；图片审核通过才进入视频与配音。Mock也经过新增第四个审核节点，图片审核前没有视频用量记录。
- 新agentImageGate保存审核时全部分镜、剧本、人物/场景和图片路径的版本摘要；缺少任一真实分镜图不能通过。审核后上游变化使摘要失效，在视频阶段入口、每次视频提交前及结束时校验，防止继续使用旧通过记录。该摘要基于数据库字段，不是文件字节哈希。
- 图片审核UI展示逐张图及动作要求；缺图提示补齐；驳回后在制作页局部修改，恢复只建立新审核快照，不自动付费批量重生。图片生成步骤重试复用已完成且提示词相同的记录。视觉模型语义判断尚未接入，不宣称能自动识别人脸/动作错误。
- 修复：视频质检引用未定义selectedVideoIds导致运行错误，改为实际videoShots；中断恢复按状态映射动作，避免图片阶段暂停后被误认成script。
- 验证：完整verify后端141/141、前端18/18、JS语法、Vue构建、隔离HTTP四审核节点冒烟通过；新7例覆盖图片生成成功仍停止、缺图、摘要失效、局部改图恢复、视频直接调用阻断、恢复阶段。浏览器5683隔离Mock确认图片审核状态、6个镜头预览占位和记录人工修改按钮。无独立类型检查脚本。日志/tmp/drama-image-gate-release.log。
- 首轮错误：审核快照误引用不存在first_frame_image_url/local_path，读取完整测试错误和迁移字段后改用实际image_url/local_path及first_frame_image_id、尾帧字段，后续测试通过。当前无新增阻塞报错。
- 生产空闲、备份before-image-gate-20260920.db后重启PID54211；health正常，历史run可读。无新增真实模型/图片/视频调用。
- 限制：本轮落地的是阶段边界、人工看图与版本失效保护；视觉Agent的证据评审和两轮局部图像修正、视频内容审核尚待接入。现有媒体生成成本仍为估算；不将这些限制标成已完成。
- 下一子问题：基于实际图像输入接入视觉审核适配器，无法判断或未配置视觉模型时保留人工审核；先Mock验证，再考虑有界真实验证。关键文件agentImageGate.js、agentProductionService.js、agentWorkbenchService.js、routes/agent.js、AgentWorkbench.vue、agentImageGate.test.js、scripts/smoke.cjs。

## 实际图片视觉审核与两轮定向修正（2026-09-20）
- 已完成：图片阶段逐镜调用独立vision_review配置，实际发送首帧、明确ID对应的角色/场景/道具参考图；不回退文本模型。核对人物造型、动作/道具归属、空间关系、构图瑕疵和信息可读性，逐项要求画面证据；静态图不冒充视频动作/音频验收。
- 已完成：每镜最多3次审核+2次定向重绘，整次运行最多30次附加调用；调用前持久化。重绘携带待修原图和参考图，只保存独立候选；审核通过后才绑定分镜，失败候选和原图均保留，两轮失败/不确定/无变化/供应商错误转人工，不自动运输重试。恢复不重置额度，也不先额外生成图片。
- 版本与安全：仅发送素材根目录内经过解码验证的静态本地图片，拒绝越界/符号链接越界/非图片/超过大小上限；保存实际字节SHA256，审核期间同路径修改或上游变化立即失效，不能覆盖人工修改。门禁元数据摘要新增连续性、身份锚点、道具及分镜关联。既有最终视频前人工图片确认保留。
- UI：AI配置新增“视觉审核（支持多图的对话模型）”；工作台独立展示每镜原图、两版候选、图片指纹及问题证据。人工接管放行必须填理由，HUMAN_ACCEPTED不伪装AI通过。原剧本面板只显示script周期，避免混入媒体版本。
- 验证：完整verify后端153/153、前端18/18、JS语法、Vue构建、隔离HTTP启动与图片人工接管冒烟通过。新增真实多图出站结构、单图兼容、不回退文本、两轮耗尽/通过绑定、同路径修改、人工编辑、取消/中断/并发、缺参考/预算、越界、恢复不重买、生产调度Mock适配器回归。纯JavaScript，无单独类型检查脚本。
- 浏览器：agent-browser在无凭据5684隔离页面确认原图/两版候选、2/2与5/5、空理由阻止放行。展示图片为测试色块、评价为注入响应，不是模型内容质量结论。
- 日志：/tmp/drama-visual-final.log；首次启动EPERM来自沙箱监听权限，读取完整日志后以本机权限重跑成功；无新增产品阻塞。Vite既有大包告警未扩大处理。
- 生产：无活动Agent/图片/视频生成，SQLite备份before-visual-review-20260920.db，5679重启且health正常；未更改旧项目素材与剧本。当前独立vision_review配置数量0，真实新任务会转人工说明原因；本轮付费调用0。
- 限制：模型真实准确率尚未验证；每次1元仅计划预留，不是供应商人民币硬封顶，成本面板尚非账单。文件指纹用于本轮审核期间变化检测；人工通过之后视频门禁仍基于数据库摘要，不能宣称能检测所有文件原位改写。视频逐帧/声音审核尚未接入。没有通知用户做成片验收。
- 下一步命令：PATH=/Users/shenzihao/.nvm/versions/node/v22.17.1/bin:$PATH npm run verify；后续独立模块补齐视频入口文件指纹有效性，再用有界、明确配置的真实视觉样本评测误判率，最后扩展视频抽帧/音频审查；不自动复用已耗尽的历史制作预算。
- 关键文件：agentVisualReviewService.js、agentImageGate.js、aiClient.js、agentProductionService.js、agentWorkbenchService.js、AgentWorkbench.vue、AIConfigContent.vue；测试agentVisualReviewService.test.js、aiClientVision.test.js及scripts/smoke.cjs。

## 审核后图片文件完整性门禁（2026-09-20）
- 完成：图片审核快照保存首尾帧及已有角色/场景/道具图的字节SHA256；放行时、视频入口/逐镜提交/生成结束均重新校验。相同路径换图、删除文件、越界、旧审批没有指纹均不能继续真实视频；Mock不伪装拥有文件。
- 验证：154后端、18前端、语法、构建通过；启动冒烟首次因沙箱EPERM，完整日志定位后本机权限重跑通过。真实调用0。关键文件agentMediaEvidence.js、agentImageGate.js、agentImageGate.test.js；日志/tmp/drama-evidence-verify.log和drama-evidence-smoke.log。
- 当前报错：无新增产品阻塞。下一步：视频实际probe/decode/内容证据分离，消除“地址存在即PASS”；下一命令npm run verify（Node22）。

## 视频技术验收、抽帧审核与批准版本导出（2026-09-20）
- 完成：实际ffprobe/完整解码、时长误差、短边720、画幅、独立配音文件解码和时长检查；损坏/缺失/不符为BLOCKED，技术通过记HUMAN_REVIEW，不再把视频地址存在写成内容PASS。
- 完成：6个时间点实际抽帧+已确认首帧送视觉模型；每镜3审2改、run最多15次附加调用。候选视频不绑原分镜，通过可见画面检查才替换；完整动作、对白、声音和口型仍要求人工播放核对，强制理由。没有视觉配置时0模型调用，仍保存技术实测。
- 完成：final_video驳回恢复、失败/中断媒体恢复仅复查，不默认批量重生成。最终审批保存视频/配音文件指纹；导出前/逐集/合成后再次核对；合成只用批准的本地片段，不误选后来生成的另一条视频。合成文件再次解码/时长/画幅检查后才EXPORTED，工作台可播放下载。
- 验证：163后端、18前端、语法、构建、隔离启动/HTTP Mock通过；新增本地720×1280视频验证真实probe/decode/6帧、两轮耗尽、候选绑定、人工修改保护、供应商远程URL准确映射本地、内容变化阻断、损坏音轨、人工接管、实际合成验收且0凭据0模型调用。
- 已修复：末尾固定偏移0.08秒在低帧率视频找不到下一帧；读完失败堆栈后改按实际帧率预留尾部两帧，9个视频专项测试通过。日志/tmp/drama-video-unit.log、drama-video-export-unit.log、drama-video-release.log。
- 限制：抽帧不能证明逐帧连贯，音轨存在/可解码不代表语义正确；本地无vision_review配置，真实效果未验证。计划预留不等于账单硬封顶。当前无新增阻塞；真实付费调用0。
- 下一步：新用户流程发现120秒被服务端缩为30/90秒、视频请求固定1080p，先修复120秒/720p目标契约，再浏览器整流程验收。关键文件agentVideoInspection.js、agentVideoReviewService.js、agentProductionService.js、agentWorkbenchService.js、dramaService.js、AgentWorkbench.vue、agentVideoReview.test.js。

## 120秒/720p契约与最终内部验收（2026-09-20）
- 完成：导演和工作台保留120秒，长方案10–16叙事节拍、120秒15镜，视频请求默认720p；不再静默缩短或固定1080p。主面板轮询同步侧栏状态，防止切换任务时旧响应覆盖；历史成片无检查记录不称已验收。视频文件检查与内容PASS分开展示。
- 验证：166/166后端、19/19前端、JS语法、构建、隔离启动与HTTP冒烟通过，无单独typecheck。日志/tmp/drama-final-acceptance-verify.log。浏览器实际本地合成视频720×1280、2秒、播放进度正常；120秒Mock计划经预算检查后进入剧本审核。测试图案不代表剧情质量。下载入口绑定已验收本地文件。
- 已修复错误：扩展resolution时首次误用seedProject作用域外input，改为plan.project后全回归通过。浏览器一次意外到about:blank，检查隔离服务HTTP200后重新打开恢复；页面切换后旧控件失效通过重新snapshot定位。当前无新增阻塞产品错误，Vite大包提示保留。
- 真实验证：最多3个视觉请求已用完（退役模型404一次、Seed2 mini两次成功），未新增图片/视频/TTS。旧角色服装不连续/拼图负样本阻断，静物正样本通过；不是统计准确率认证。成功用量5752输入/2643输出，估算0.0064364元，失败账单未知，保留1元预留。独立vision_review配置8已接入，不含密钥提交。本轮不再调用。
- 部署：无活动生成任务，SQLite备份before-final-acceptance-20260920.db后重启本机5679，PID16227、health正常，日志/tmp/ai-drama-final-acceptance-server.log。
- 验收结论：带人工审核的MVP工作流通过内部验收；不宣称无人值守精品成片、逐帧/口型自动验收或账单硬封顶。报告docs/internal-acceptance-20260920.md。关键文件directorService.js、agentProductionService.js、DirectorCreate.vue、AgentWorkbench.vue、qcSummary.js及对应测试。
- 下一步命令：PATH=/Users/shenzihao/.nvm/versions/node/v22.17.1/bin:$PATH npm run verify；后续按新制作预算做真实多镜头动作/声音/叙事评测，不复用耗尽的制作额度。

## ChatCut剪辑交接层（2026-09-21）
- 完成：供应商无关editing-handoff/v1清单，导出批准的原始片段与独立配音轨、源入出点/时间线起点、对白对齐提示、源音轨处理要求及零新增生成预算。入口/api/v1/agent/runs/:id/editing-handoff；工作台已批准视频后显示下载。
- 版本门禁：拒绝Mock、缺审批、历史无字节指纹、源文件变化；交接前后核对全部批准版本，附SHA256和确定性handoff_digest。不打包密钥、不上传素材、不标记为ChatCut已连接，不声称JSON为ChatCut原生工程。
- 验证：167后端/19前端、JS语法、Vue构建、隔离HTTP启动与Mock交接拒绝通过；日志/tmp/chatcut-handoff-final.log。没有TypeScript独立检查。新fixture先缺created_at，修复后暴露macOS /var→/private/var规范化断言差异，按realpath修正，全回归通过。
- 外部阻塞：本机arm64未找到ChatCut标准安装、无ChatCut工具。官方地址https://api.chatcut.io/desktop/download/macos连接检查SSL超时、实际GET连接超时（curl28），未获得安装包，未安装/登录。按官方connect-chatcut-desktop skill请求用户可视安装登录；不得猜端口/手写desktop MCP。研究见docs/chatcut-integration-research-20260921.md。
- 未完成：真实工程导入、局部返修、导出回传、整片验收、设为可选自动成片引擎。当前仅Agent交接入口，不改变已有默认合成。真实模型/生成调用0，付费0。
- 关键文件editingHandoffService.js、routes/agent.js、routes/index.js、AgentWorkbench.vue、agentVideoReview.test.js、scripts/smoke.cjs。下一命令Node22 npm run verify；外部连接后以真实tool schema建立素材ID映射，并保留工程/时间线ID及一次局部修改证据。
- 本机加载：无活动生成，备份before-chatcut-handoff-20260921.db后重启PID70588，health正常；历史Mock run请求交接返回400并明确没有真实素材，未误放行。日志/tmp/ai-drama-chatcut-handoff-server.log。

## ChatCut Desktop 实机验证（2026-09-21，进行中）
- 已连接真实桌面工程372c5083-8098-4714-812d-dc00d79f9f33；初始工程为空。新建720×1280时间线36d6d7fea6，不覆盖原时间线。
- 使用《今天重来》v02历史内部样片的16个原视频及16段独立旁白，保存SHA256与probe到backend-node/data/acceptance/chatcut-20260921/sources.json；不伪造旧Agent审批或调用生成。
- 导入首轮16视频成功、16 AIFF失败（扩展名不支持）；本地PCM WAV转换后16旁白全部导入成功。原音视频文件保留。
- 当前建立80秒/30fps独立视频与旁白轨；源视频轨静音避免原音混杂。尚待局部返修、回读、实际导出检查。
- 次要检查错误：报告中的production-manifest-v02实际文件名为production-manifest.json，已用rg定位；不存在的backend-node/storage改为实际data/storage。无生产数据库改动。
- 实机技术验收通过：32素材、多轨80秒；保留v1，v2仅第13镜旁白后移18帧，回读确认其他31片段不变。原生MP4导出80.000秒720×1280/30fps/H264/AAC，完整解码exit0，16段音频相关系数>0.9987，源文件指纹未变；可编辑XML导出并解析成功。
- 验证：155JS、167后端、19前端、Vue构建通过；HTTP冒烟首次listen EPERM，获准本机监听后重跑通过。无独立typecheck。付费生成0。
- 报告docs/chatcut-desktop-acceptance-20260921.md；证据backend-node/data/acceptance/chatcut-20260921/。当前v2=f1f0ba60-c722-4b97-9980-a7918a4c0574。MP4在~/Movies/ChatCut/ai-drama-chatcut-20260921-v2.mp4。
- 下一子问题：迁移原字幕/剧情浮层并做内容复审，随后实现导出回传门禁；未开启可选自动成片引擎，未将此技术样片替换原成片。下一检查命令：git diff --check；读取上述报告与v2时间线。

## 统一交付规划（2026-09-21）
- 新建docs/delivery-roadmap.md：16项任务、四个里程碑、依赖、验收标准、证据与责任边界。同步最新ChatCut实机进展，旧安装阻塞解除，字幕/内容复审/自动适配与回传仍待完成。
- 本次仅文档整理，不修改服务/数据、不运行付费调用；链接与git diff格式检查，无需重跑未变更业务测试。下一项B3字幕/剧情浮层迁移。

## ChatCut B3字幕/剧情浮层（2026-09-21）
- 已完成：复制v2到v3（9c99d540-0af8-4e60-b7ee-5199d113c78f），迁31条原文为独立可编辑MG图层；第13镜字幕60.6秒入场，其他时段保持原ASS。不是原生caption转录卡片。
- 验证：31条有效文本/时段回读一致，32源文件指纹不变；11点Desktop预览及实际导出帧文字可读；80秒720p完整解码通过，v2/v3解码PCM完全一致。167+19、语法、构建、启动HTTP冒烟通过；无typecheck。日志/tmp/chatcut-v3-verify.log，报告docs/chatcut-subtitle-acceptance-20260921.md。
- 修复：字体缺projectId、MG初稿校验失败、字幕被视频遮挡、无效order范围、核对脚本默认文字选择错误，均有定位与通过证据。当前无新增阻塞，旧内容WARN继续保留。付费0、未改生产数据。
- 文件~/Movies/ChatCut/ai-drama-chatcut-20260921-v3.mp4；下一项B4完整内容复审，随后真实批准链/回传。下一命令读取B3报告及v3时间线，不重复迁移或重新生成。

## B4内容复审与旁白版本纠正（2026-09-21）
- 完成：16镜64采样帧复审；定位ChatCut导入误选05/13旧录音，而旧合成脚本使用revised。保留v3，v4只替换两段既有修订录音，其余61元素不变。根因是交接版本选择，不能推给模型生成速度。
- 验证：v4原生80秒720×1280/30fps完整解码；两段源音相关性>0.9989，其他14镜内部PCM与v3一致。155JS、167后端、19前端、构建和隔离启动HTTP冒烟通过，无typecheck。付费0。
- 报错处理：assetId immutable→读取完整项→原子删除/新增；HTTP EPERM→获准本机冒烟成功。完整日志/tmp/chatcut-v4-verify.log、/tmp/chatcut-v4-smoke.log。未改业务代码或生产数据库。
- 当前未通过：亮背景字幕对比、道具称谓/设备语义、结尾可视化与追更钩子；完整动态播放和听审尚缺证据，B4仍在进行，不能通知成片验收。内部素材发布约束保留。
- 关键文件：docs/chatcut-content-review-20260921.md；backend-node/data/acceptance/chatcut-20260921/v4-validation.json与v4-timeline-diff.json；输出~/Movies/ChatCut/ai-drama-chatcut-20260921-v4.mp4，时间线588c78e7-81f0-4d00-8908-7077f48f06c0。
- 下一步：修字幕对比度后继续B4，C1须从批准快照绑定文件/文字/录音版本，不能按文件序号猜源。下一命令git diff --check；读内容报告和当前时间线，再作局部修改。

## B4字幕亮背景修复 v5（2026-09-21）
- 完成：保留v4，复制v5（b0a3374f-e3c9-4f11-a9ed-1874d586315e），16条旁白字幕增加72%黑色局部衬底及阴影；文字、字体、位置和时段不变，其余47元素不变。
- 实测：白闪/纸面/亮桌面/暗景四点Desktop预览，实际白闪导出帧可读；80秒720×1280完整解码，音频与v4解码PCM完全一致。源素材不变，付费0。
- 测试：连同下一模块运行156JS语法、170后端、19前端、Vue构建、隔离启动HTTP冒烟全部通过；无独立typecheck。日志/tmp/chatcut-v5-plan-verify.log。
- 当前报错：无新增阻塞。B4仍缺完整动态/听审证据，旧叙事与发布约束仍在，不称完整成片验收通过。证据backend-node/data/acceptance/chatcut-20260921/v5-validation.json、v5-text-readback.jsonl、v5-timeline-diff.json。
- 下一子问题：将批准链的准确素材版本交给Desktop执行器；禁止按序号选文件。输出~/Movies/ChatCut/ai-drama-chatcut-20260921-v5.mp4。

## C1批准素材导入计划与映射校验（2026-09-21）
- 完成：GET /api/v1/agent/runs/:id/chatcut-import-plan。经现有真实视频审批与文件指纹门禁产生导入计划，绑定文本/录音/画面同一handoff digest；导入前重新读取准确文件指纹，不扫描目录猜新旧版本。
- 完成：映射校验拒绝错目标工程、旧回执、缺项/重复项、SHA/字节数错配、不同素材共用同一Desktop ID。允许回执乱序，按稳定source_id关联。只验证执行器回执与本地源，明确desktop_connection_verified=false，绝不改成片状态。
- 测试：3个专项测试覆盖历史旧旁白回归；批准链集成与Mock HTTP拒绝；全量170+19/语法/构建/启动冒烟通过。没有真实新批准任务导入、幂等持久化或导出回传，C1仍部分完成。
- 关键文件：chatcutImportPlan.js、chatcutImportPlan.test.js、agentVideoReview.test.js、routes/agent.js、routes/index.js、scripts/smoke.cjs。下一步是执行器与持久化，不将计划下载当作已连通。

## C1素材执行器与断点持久化（2026-09-21）
- 完成：chatcutAssetImporter以可信宿主注入的官方MCP传输读取工程/当前操作、逐文件导入并回读ID/类型。每次导入前后重查批准链；迁移28按run/交接摘要/工程/source_id保存PENDING、IMPORTED、UNKNOWN。
- 完成：已成功项重复执行只回读，不重复push；调用结果不明或崩溃遗留PENDING不自动重试；错工程0写入，源变更不记成功。已知AIFF不兼容在提交前阻断，待带指纹的无损转换，不偷选其他WAV。
- 验证：173后端、19前端、157JS语法、构建、隔离启动HTTP冒烟全部通过；无typecheck。注入传输验证持久化/幂等/异常与源变更，未宣称新执行器已与真实Desktop批准任务联调。日志/tmp/chatcut-importer-verify.log、chatcut-importer-unit.log。
- 本机：无活动生成，备份before-chatcut-importer-20260921.db，安全重启5679 PID18656；迁移28成功、health正常，日志/tmp/ai-drama-chatcut-importer-server.log。首次健康读取发生在启动前，完整启动日志确认后再次成功；无当前启动错误。
- 限制：尚无生产MCP传输接线/前端执行按钮、未知操作对账恢复、时间线自动创建和导出回传。源SHA在本地核验，Desktop回读ID/类型不等于其内部文件哈希证明。费用0。
- 关键文件：chatcutAssetImporter.js、28_chatcut_imports.sql、agentVideoReview.test.js、docs/chatcut-import-adapter.md。下一步宿主传输与对账恢复，再做时间线/回传；保留B4动态听审未完成状态。下一命令读取本段与git diff，再运行新增模块专项测试。

## C1真实Desktop传输与自动时间线（2026-09-21）
- 完成：从已注册chatcut_desktop读取官方启动配置，通过Python exec和Node JSON-RPC传输连接，密钥环境不输出；允许操作白名单，超时关闭不重放。实机只读确认工程372c5083-8098-4714-812d-dc00d79f9f33及57项当前操作。
- 修复：真实get_guidelines只有JSON文本content，旧Mock假定structuredContent；传输现解析单一JSON文本，新增真实格式回归，不把普通说明文字当结构化结果。
- 完成：迁移29保存剪辑任务与逐操作日志；批准镜头自动创建独立时间线、画面/对白/旁白轨，按实际fps转换帧/微秒；回读片段数、资产、时段和完整项快照。配音超长阻断，不静默截断；有独立配音的镜头抑制原视频声音。当前活动时间线被切换则停止修改。
- 实机：两次隔离色块/提示音测试自动导入→建轨→放置→导出通过；时间线53c0c91c-3197-429d-b272-1683381210d6和b11ec6a3-0531-447f-a51b-65dd69175cfa。用户原短剧时间线未改；重复prepare不增加操作记录或重复导入。费用0。
- 本阶段日志/tmp/chatcut-pipeline-live.log、chatcut-pipeline-voice.log；证据data/acceptance/chatcut-pipeline-1789972319456与chatcut-pipeline-1789972670158。仍不是120秒剧情质量验收。

## C2/C3实际导出回传与工作台（2026-09-21）
- 完成：导出任务入队只记EXPORT_QUEUED；检查文件写入稳定、完整解码、时长/画幅/分辨率，回传到项目storage，保存SHA256与时间线版本，只记REVIEW_REQUIRED。导出前后/回传前后重查批准源与时间线，变化阻断；复制结果同路径篡改亦拒绝。
- 完成：工作台可只读连接当前Desktop工程、明确展示工程名、创建剪辑稿并导出、轮询回传、播放/下载待审稿。保留原本地合成。桌面操作仅接受本机和本地Origin，Mock在建立连接前拒绝。
- 实机：两秒720×1280原生输出回传成功，独立音轨实测原440Hz/配音880Hz振幅比0.00003887；只证明测试音混合，不冒充真人听审。声学脚本最初ffmpeg拒绝“.2”时间参数，改“0.2”后通过，未涉及重新生成。
- 浏览器：agent-browser在隔离5686工作台连接真实工程成功；回传视频readyState4、duration2、播放推进至2秒、无媒体错误；点击重复创建无错误，待审下载入口存在。截图/tmp/chatcut-workbench-acceptance.png。
- 回归：177后端、19前端、语法/构建/启动HTTP冒烟通过，日志/tmp/chatcut-ui-pipeline-verify.log；刚补的活动时间线保护正在补最终回归。无typecheck。当前尚未发布到5679，避免混淆测试环境与生产。
- 边界：当前自动建立粗剪，不自动编写字幕、配乐、复杂转场；用户手改时间线会失效，重新采纳编辑版本和不确定操作对账入口待开发。完整剧情动态/听审未完成。导出回传可验证，但不能称无人值守精品成片。
- 关键文件：chatcutMcpClient.js、chatcut_registered_mcp.py、chatcutEditingService.js、29_chatcut_editing_jobs.sql、AgentWorkbench.vue、api/agent.js、agent路由；chatcut-local-acceptance.cjs显式传工程ID才会进行实机测试，普通verify不会触发Desktop。

## 自动剪辑闭环最终联调与部署（2026-09-21）
- 新增：记录成片人工审核，要求具体依据，重新核验源/时间线/输出指纹后绑定APPROVED；空理由阻止。局部剪辑采用流程保存旧版记录、清除旧审核、新摘要和独立文件名导出，避免直接替换已审文件。
- 完成实机：提示音降低3dB→采用修改→旧版归档→新文件导出→工作台轮询回传。浏览器空审核被阻止，明确标记自动化测试的隔离记录可提交；待审下载变为人工验收版。原短剧v5未改。
- 最终回归177后端、19前端、语法、构建、隔离启动HTTP全部通过，日志/tmp/chatcut-release-verify.log。无typecheck；费用0。报告docs/chatcut-pipeline-acceptance-20260921.md。
- 部署：无活动生成，备份before-chatcut-pipeline-20260921.db后重启5679，PID70560，health正常；日志/tmp/ai-drama-chatcut-pipeline-server.log。ChatCut焦点恢复今天重来v5。
- 仍未完成：原生字幕/MG/特效/转场的自动版本证据与对账恢复；当前发现即拒绝自动验收。粗剪已通但完整真实剧情动态听审与120秒样片未过，不能宣布整体作品验收。
- 下一优先项：扩展字幕/MG/转场证据，再完善不确定操作对账；生产预算不自动新增。关键文件chatcutEditingService.js、chatcutMcpClient.js、chatcut_registered_mcp.py、迁移29、AgentWorkbench.vue与agentAPI/路由。下一命令先读取本段、git diff和对应日志，不重复做已通过的色块联调。

## 高级图层证据与全片信号检查（2026-09-21）
- 完成：共享MG模板默认值/可读源码摘要、实例特效引用与原生字幕响应进入时间线版本；缺源码/未知引用/未验证原生字幕分页显式记录gaps，导出可继续、成片通过被阻止。采用新字幕图层不再一律拒绝，未批准的新音视频仍拒绝。
- 实机：今天重来v5回读63项、3个MG模板；includeCodeFile在无Desktop代理工作区时明确拒绝，普通inspect只返回空html，不能冒充源码已核验。只读证据v5-layer-evidence.json，无改片。
- 完成：回传时新增完整视频/音轨信号扫描、冻结/黑场/静音区间定位及工作台提示。80秒v5全覆盖解码，无>=1秒冻结；3处单帧黑场、16处旁白后静音已定位，尚未代替语义判断。
- 验证：161JS语法、182后端+19前端、Vue构建通过；隔离启动首次EPERM，授权本机回环后HTTP冒烟通过。日志/tmp/chatcut-advanced-verify.log、/tmp/chatcut-advanced-smoke.log。无typecheck，费用0。新服务代码尚待生产重启。
- 下一步正在执行：临时本地faster-whisper small整条音轨转写，比对字幕与旁白时间/语义，生成按镜头定位的修正清单。关键文件chatcutLayerEvidence.js、finalCutInspection.js、chatcutEditingService.js、transcribe-local.py；证据data/acceptance/chatcut-20260921/v5-full-signal-review.json。

## 完整音轨转写、真实黑帧修复及部署（2026-09-21）
- 完成：本地Whisper small转写80秒/16句，与v5时间线实际字幕逐条对比；按文件SHA绑定证据。同音字/数字差异不擅改台词。新增audioTranscriptReview.js与可选CLI transcribe-local.py，模型/依赖仅临时安装，未调用付费API。
- 完成：v6独立时间线修原3个黑帧，验证发现另外2个切点黑帧，不能宣称原生导出稳定；v7本地确定性替换2帧后整80秒无黑帧/无>=1秒冻结，音轨PCM完全一致。保留v5/v6。v7路径data/acceptance/chatcut-20260921/ai-drama-v7-cut-repair.mp4。
- 测试：162JS语法、184后端+19前端、构建、隔离启动HTTP冒烟通过，日志/tmp/chatcut-audio-final-verify.log。无typecheck。新增费用0。
- 部署：无活动生成；备份before-chatcut-advanced-20260921.db，重启5679 PID90170，日志/tmp/ai-drama-chatcut-advanced-server.log。
- 未解决：MG源码被Desktop工作区限制，原生字幕分页实测不足；GUI读取卡住被中断。转写尚为显式CLI，未后台接入；机器识别不冒充主观音质/完整动作语义审核。报告docs/chatcut-full-review-20260921.md。
- 下一子问题：将本地转写作为有状态可轮询审核任务接入，绑定采用后的音轨实际时间而非旧脚本序号；失败只记录待审，不自动生成或付费重试。下一命令先读取本段、git diff与上述报告。

## 解除源码缺失对文件验收的过度阻塞（2026-09-21）
- 原因：approveExport将MG源码缺失作为禁止人工验收已导出文件的条件，混淆工程源码证据与成片内容审核。
- 修正：人工审核记录明确scope=EXPORTED_FILE_ONLY，绑定文件SHA；源码缺口继续保留，project_reapproval_required_on_export=true，后续导出不得继承。保留技术检查、审核依据、文件/已知时间线变更拒绝，不自动批准任何真实作品。
- 验证：新增不可读MG图层→导出待审→人工文件审核→篡改拒绝集成用例；185后端+19前端、162JS语法、构建、隔离启动HTTP冒烟通过。无typecheck。日志/tmp/chatcut-review-scope-verify.log；费用0。
- 部署：无活动生成，备份before-file-review-scope-20260921.db，加载本地5679；日志/tmp/ai-drama-file-review-server.log。
- 音频事实：80秒16句本地转写已经完成；不要求ChatCut源码。主观音质、情绪/画面对齐可另设审核项，不能因此否认转写能力或阻止无关开发。下一子问题仍是后台本地转写任务接入；关键文件chatcutEditingService.js、AgentWorkbench.vue、agentVideoReview.test.js。

## 本地音频审核队列与工作台接入（2026-09-21）
- 完成：迁移30持久化QUEUED/RUNNING/DONE/FAILED/INTERRUPTED/STALE。回传后自动排队，历史剪辑稿可手动启动；失败显式重试、重启不重放、单并发/5等待/10分钟超时，无付费回退。
- 完成：按采用后的实际音轨起止时间绑定批准台词；静音跳过、裁切/变速标缺口。文件SHA/时间线摘要绑定，运行中和完成后篡改失效。逐句对照、额外语音、低置信度、完整转写和定位播放已接工作台，不自动审批成片。
- 修复实测：纯提示音被Whisper幻觉识别；加入本地VAD后返回0段语音，预期台词逐句标缺失。VAD合并相邻句子导致时段错配，改用逐词时间按句拆分；真实80秒16条旁白0缺失、0未匹配时段，同音/数字差异保留。
- 实机：独立5686测试库执行真实本地模型，HTTP立即返回QUEUED，轮询至DONE；浏览器展开逐句、定位视频播放无媒体错误。证据data/acceptance/local-audio-queue-vad-20260921.json与chatcut-20260921/v5-audio-vad-review.json，截图/tmp/drama-audio-queue-ui.png。没有批准真实样片。
- 验证：193后端+19前端、163JS语法、Python编译、Vue构建、隔离启动HTTP全部通过；无typecheck。日志/tmp/local-audio-delivery-verify.log。新增付费0。
- 部署：模型及venv从临时目录转到Git忽略的data/local-asr；无活动生成，备份before-local-audio-queue-20260921.db后重启5679；日志/tmp/ai-drama-local-audio-server.log。
- 交付修复：历史backend-node/scripts整个目录被忽略，现只对白名单3个必要集成脚本解除忽略，避免Git遗漏。可选依赖requirements-asr.txt，安装/状态说明docs/local-audio-review.md。
- 下一子问题：声学质量指标（响度/削波/对白覆盖）与字幕画面审核；本轮完成转写核对，不声明情绪/音色/口型质量通过。关键文件localAudioReviewJobs.js、audioTranscriptReview.js、transcribe-local.py、迁移30、agent路由/API和AgentWorkbench.vue。

## 新案例验收发现：文字提及误变出镜角色（2026-09-21）
- 复现：隔离新案例第4镜原始characters=[李默]，“绕开主管”被syncStoryboardCharacters字符串匹配补成两人；这会污染后续参考图名单。
- 修复：文字提及仅返回mentioned/记录核对日志，不再改写明确角色名单，保留空镜、单人、多人定义；新增否定描述/台词提及/跨项目角色回归。
- 验证：194后端+19前端、JS语法、Vue构建、隔离启动HTTP冒烟通过；本项目无typecheck。日志/tmp/new-case-verify.log。隔离5687重启后真实页面驳回→按意见重生成，第4镜恢复[1]；生产5679尚待最终部署。
- 费用0。新案例仍在验收中，不宣称成片通过。下一命令：继续5687案例8d2c3968-295d-41b3-b8ac-930c34a88470图片审核→视频→ChatCut回传与ASR。关键文件imageService.js、episodeStoryboardService.js、storyboardCharacterMentions.test.js、scripts/new-case-acceptance.cjs。

## 新案例验收发现：ChatCut音频源边界与提前验收文案（2026-09-21）
- 复现：3.165秒音频ceil成95帧(3.1667秒)，ChatCut报source range exceeds asset。实际官方回读确认音频3165000微秒、失败时间线0条元素。
- 修复：整帧向下量化，末尾不足1帧不进入剪辑；validateOnly移到写操作日志外，纯校验失败可显式重试，不再误记UNKNOWN。真正不确定写操作仍拒绝自动重试。
- 旧隔离案例的UNKNOWN已通过完整空时间线回读做一次显式对账，原记录归档reconciled-empty-before-fix；没有改任何审批。随后通过页面复用时间线/已导入素材，12片段成功进入原生导出。
- UI修复：自动合成文件改为“下载待审合成稿”、状态“已合成，内容待审”，不提前宣称精品成片验收通过。
- 验证：196后端+19前端、JS语法、Vue构建、隔离启动HTTP冒烟全部通过；无typecheck。日志/tmp/new-case-final-verify.log；费用0。关键文件chatcutEditingService.js、agentVideoReview.test.js、AgentWorkbench.vue。
- 当前剩余：等待30秒ChatCut文件回传、本地ASR与播放检查；下一命令读取5687新案例状态及/tmp/new-case-server.log。

## 新案例功能闭环验收结束（2026-09-21）
- 新项目《【零付费回放验收】最后一通电话》在隔离5687完成页面新建、4阶段审核、返修、6图6视频6旁白、ChatCut12素材独立时间线、30秒720×1280回传、自动ASR6句核对。重复创建1时间线/1导出，浏览器全片播放与定位/刷新恢复通过。真实付费0。
- 发现并修复：文字提及误加出镜角色；ChatCut旁白ceil越界/只读校验失败误记UNKNOWN；合成下载提前称已验收。196后端+19前端/语法/构建/启动HTTP通过，无typecheck。正式5679已备份重启、health正常。
- 作品结论未通过：原生导出3处孤立黑帧、缺字幕/新尾钩子、节奏偏松。单独本地修正版已去除3黑帧，30秒完整扫描无黑/长冻结、音轨PCM相同；不是工作台自动修复，也不是原生稿已通过。原job保持REVIEW_REQUIRED。
- 报告docs/new-case-acceptance-20260921.md；证据data/acceptance/new-case-20260921。隔离run=8d2c3968-295d-41b3-b8ac-930c34a88470。用户可以现在验证功能；不把旧素材回放当成新模型质量证明。
- 下一子问题：版本化的显式黑帧修复回传，再做字幕/真实剧情内容验收；不重复已通过的新建到ASR链路。下一命令先读本报告与git diff。服务器日志/tmp/ai-drama-new-case-server.log、/tmp/new-case-server.log。

## 全新素材20元案例：角色合同传递修复（2026-09-21）
- 用户授权新案例总预算20元，范围缩为原创《别开第二次门》15秒3镜/1角色/1场景，Seedream4.5+Seedance2mini+Seed2mini文本/审核；官方价格已核对。隔离5689真实业务和5690预算网关，未复用旧素材，所有POST先同步落账预留、失败不退回、20元不足则阻断。
- 首次真实生成发现：正文省略外观后，角色提取只读正文，模型把黄卫衣短发猜成灰衣长发。已暂停下游，尚未生图；旧错误角色草稿通过API软删除保留记录。
- 修复：资产提取传完整已确认创意与角色合同；相同角色的新建外貌优先采用已确认appearance_lock/visual_anchor，不允许提取模型覆盖；已存在手工角色不覆写。
- 验证：198后端+19前端、语法、构建、隔离启动HTTP冒烟通过，无typecheck；日志/tmp/original-character-contract-verify.log。网关预算测试通过；当前累计预留2.25元（非账单）。
- 下一步恢复run=12562371-c348-4717-b9b3-250c8dcf85d3，审新定妆与分镜后生成新视频、字幕、导出和音轨验收。关键文件characterGenerationService.js、agentProductionService.js、approvedCharacterAppearance.test.js、scripts/original-case-server.cjs及original-case-budget.cjs。生产5679暂未重启此修复。

## 全新20元案例：声音警告被误画手机UI（2026-09-21）
- 实际图ig_ab695d38出现巨大透明手机框，完整effectivePrompt证实代码根据“手机+警告+反应”强加“手机信息双层构图最高优先级”，并非单纯模型随机偏差。
- 修复screenContentCompositionService只对明确可见屏幕内容触发，不将录音警告、通知声、来电铃声转换为视觉浮层；保留弹幕与明确屏幕警告用例。
- 验证199后端+19前端、JS语法、Vue构建通过；初次HTTP冒烟因沙箱listen EPERM，允许本地监听后单独smoke通过。无TypeScript/typecheck。日志/tmp/original-screen-warning-verify.log、/tmp/original-screen-warning-smoke.log。
- 新案例图片局部修正仍在审核，手机参考已补齐；旧审核因缺参考转人工，未伪写自动通过。脚本门闩改常见旋钮反锁，剧情不变；付费网关仍20元硬上限。下一命令读取data/production/do-not-open-v01预算及局部修图10/11/12，再确认新图后启动视频。正式5679尚待部署两处修复。

## 原创20元案例：两轮后人工节点（2026-09-21）
- 实际新素材已完成剧本、角色定妆、场景、手机参考、3首帧及局部修正；当前采用10/11/12，累计预留7.50元，尚无视频付费。
- 独立看图复审v3：第一/三镜通过，第二镜与第一镜手机持手不同。第二镜已有两轮局部修正，遵循用户“两轮仍不通过转人工”，已询问明确换手机动作后继续或暂停修图；保持IMAGE_REVIEW，未自动放行。
- 此轮具体收益：角色合同丢失、声音警告误加手机UI两处代码根因修复；正式5679无活动生成，备份before-original-prompt-fixes-20260921.db后部署，health正常。199后端+19前端、语法/构建/隔离HTTP冒烟全部通过，无typecheck。
- 报告docs/productions/do-not-open-v01/EP01/qc_report.v02.md；新版剧本script.v02.md、分镜storyboard.v02.json；实际证据data/production/do-not-open-v01。下一步收到人工决定后，通过正常API更新动作合同→新图片审核快照→3×5秒720p视频→完整动态/音轨/字幕/ChatCut回传验收。不得宣称本案例全链路完成。

## 原创案例继续：落实显式换手（2026-09-21）
- 用户明确要求已知问题继续自主优化，不再等待重复判断。已修改实际剧本及三镜动作：S001末段右手交左手、S002右手反锁/左手手机、S003左手保持；旧文件保留，新增script.v03.md和storyboard.v03.json。
- 通过正常驳回→恢复生成新快照→填写逐图审核依据→放行视频，没有直接修改审批表。第一段真实Seedance2mini 720p5秒任务已受理，供应商状态running。
- 重新读取账本发现上一轮最后一次独立复审后实际累计预留为7.75元（上一进度7.50是请求完成前数值）；第一视频预留后10.75元，仍20元硬封顶。
- 新建ChatCut对白字幕MG b2600327-5047-409b-9eb1-5f1ee37e212a，校验通过，仅素材池新增，未改旧时间线。等待新视频实际动作、音轨验证后进入新时间线剪辑。尚未验收通过。

## 原创新素材小样闭环完成（2026-09-21）
- 用户要求继续自主优化后落实明确换手：真实首镜可见右手→双手→左手，独立视频审核时间证据通过。三段Seedance2mini真实5秒视频与原生语音均成功，三句实际音轨转写匹配。
- 第二镜仍有锁体物理转动瑕疵，零付费本地剪辑重构图至人物中近景，把门锁放画外，保留动作/锁声/后退/对白；原片保留，PCM相同。不是宣称原始门锁已生成正确。
- 正常最终审核后合成；ChatCut适配器导入3个新视频→独立时间线dfdc6a1f-f863-4e62-8caa-93c725d79f9f→3条可编辑MG对白字幕→采用版本→本地导出→回传→自动ASR完成。job=a01a2501-8edf-4a46-9704-9b20f005a179，当前文件已记录最小案例验收，后续导出须重审。
- 实际导出15秒720×1280；全片解码/无单帧黑场/无长冻结；音频峰值-1.397dBFS；ASR3条TEXT_MATCH/0额外段。浏览器真实播放到15秒ended无媒体错误。主观音色/情绪与精品质量不由这些检查证明。
- 累计预算预留17.50元（非账单）：13图片请求3.25、3视频9.00、21文本/视觉5.25；上限20元，剪辑/字幕/本地ASR无新增模型费用。
- 报告docs/productions/do-not-open-v01/EP01/qc_report.v03.md；脚本/分镜v03；文件data/production/do-not-open-v01/chatcut-exports/a01a2501-8edf-4a46-9704-9b20f005a179-6678b990-b69d-433f-ad0b-0bfc9b75d16f.mp4。SHA9c0a07f2f2aed5f63ad5961c3bea91f4f003ebabf7e6eee563f62be78c45405b。
- 本轮无新增业务源码变更；延续已通过199后端+19前端/语法/构建/启动检查，另做实际新合同、全片扫描、ASR和页面播放冒烟。正式5679与隔离5689运行中。下一步若扩大制作规模，优先完善道具状态与前后帧约束、把本轮Agent局部剪辑策略产品化；不将本次人为编排视为全自动精品能力。

## Seedance2.5同输入对照（2026-09-21）
- 用户明确要求改用Seedance2.5再生成，并暂时不限制预算；本轮限定原第二镜一条5秒720p，不批量重生成，不自动重试付费提交。
- 独立目录data/production/do-not-open-seedance25-v01，直接使用配置供应商，模型doubao-seedance-2-5-260628。首帧SHA、完整提交提示词、时长、分辨率与原Mini视频2一致；未控制随机seed，单样本不能推断模型总体胜率。
- 已受理task=cgt-20260921192553-nea1h，未改旧审批/成片。请求前写入request-started.json，结果不明不得重新POST；轮询复用task ID。参考估价约7.56元/条（先前官方价），非实际账单。
- 运行脚本语法、输入一致性断言通过；无业务源码变更。下一命令读/tmp/seedance25-comparison.log，完成后运行/tmp/inspect-seedance25.py，检查实际手/旋钮/把手及对白，再给比较结论。

## Seedance2.5对照结果（2026-09-21）
- 单条真实请求成功，模型doubao-seedance-2-5-260628；5.056秒720×1280/24fps，返回108900 tokens，估价非实际账单。无新增重试。
- 相同首帧和提示词下，把手稳定性、右手上移/松开/后退改善；但椭圆部件前后仍竖直，无法确认90度旋转，反锁状态验收未通过。未以裁剪掩盖，未替换旧成片。
- 全片解码/黑场扫描通过，ASR“锁好了”匹配，峰值约-10.19dBFS；不声称完整主观听审或精品验收。仅素材/文档变更，脚本语法及同输入断言通过，未重复业务测试。
- 关键报告docs/productions/do-not-open-v01/EP01/seedance25-comparison.v01.md；证据data/production/do-not-open-seedance25-v01。下一项为可辨识拨片锁首尾状态设计与单动作验证；下一命令先读报告与git diff，再设计新输入，避免重复同提示词付费抽样。

## 锁具状态验证与审核标准修正（2026-09-21）
- 用户批准新锁具首尾帧+单动作镜头计划，沿用Seedance2.5授权及本轮不设预算上限，限定一条视频、无自动重试。新图2张由imagegen生成，画出竖直/水平拨片；图像账单不可见，不声称免费。任务cgt-20260921194251-lfohz生成中。
- 视频审核新增独立“道具交互前后状态”必检项，提示审核分别提供起始、接触中间、松手结果证据；对白/手部活动不能替代状态改变。格式门禁可拦缺项，但不能证明视觉模型永不误判，仍保留完整动态复核。
- 200后端/19前端测试通过，JS语法、Vue构建与隔离启动HTTP冒烟通过。纯JS无typecheck；构建保留非关键大包警告。日志/tmp/lock-v02-*.log。当前常驻服务是否载入新代码尚未确认，不声称已热部署。
- 新分镜versions/storyboard.lock-insert.v04.json；首尾图及请求data/production/do-not-open-lock-v02。旧审批/素材/成片保留。新锁与旧广角不一致，整片替换仍需连戏修正。下一命令读取/tmp/lock-v02-generation.log，成功后逐帧检查旋转与松手稳定状态。

- lock-v02真实视频已成功：拨片接触→连续旋转→松手后水平保持，固定底座/把手稳定；但袖口浅色违背黄卫衣，标REVISE。准备一轮有界修正：首帧直接画入黄袖口右手，再生成1条，不自动重试。5689已备份并重启加载审核规则，health正常。

- 黄袖口局部修正版lock-v03已受理cgt-20260921194741-fyv60；首帧新增黄袖口，尾帧字节不变，输入断言/脚本语法通过。新增1图片+1视频（本轮合计3图2视频）；视频参考估价合计15.12元，非实际账单，图片工具费用未知。等待实际输出，未提前放行。

## 新拨片锁单动作通过（2026-09-21）
- lock-v03任务cgt-20260921194741-fyv60成功；黄袖口保持，接触→连续90度旋转→松手后水平保持。20张全图+120张锁区帧复核通过该单镜动作标准，原片未剪裁修改；不代表整片/主观音效通过。
- 720×1280/24fps/5.056秒，全解码/黑场扫描通过，ASR无对白，音频峰值-8.23dBFS。200后端/19前端/语法/构建/隔离HTTP已通过，新审核部署5689 health正常。
- 两次视频均108900 tokens；参考估价共15.12元非账单，3图片工具费用不可见。无自动付费重试。当前无生成报错；整片连戏仍需统一旧锁具。
- 报告docs/productions/do-not-open-v01/EP01/versions/qc_report.lock-v03.md；素材data/production/do-not-open-lock-v03/lock-action-v03.mp4；可本地访问http://127.0.0.1:5689/static/reviews/lock-v03/lock-action-v03.mp4。下一命令读取报告并检查旧广角锁具，再制作整片版本，禁止直接沿用旧审批。

## 原创30秒有限动态样片：制作中（2026-09-21）
- 用户明确批准自主执行30秒方案与现有接口提交任务；新增接口保守预算60元，每镜最多2候选。新目录data/production/do-not-open-30s-v01，原成片不覆盖。
- 六镜剧本/对白/角色契约已落盘；先完成30秒零付费动态分镜animatic-v02.mp4。系统语音沙箱下空文件，改用Tingting并允许系统服务后成功；首版静音预览保留，不伪装有音轨。
- 红痕首帧由imagegen生成1张，账单不可见单列，不声称零费用。正式MiniMax speech-2.8-hd七句全部成功，首句ASR匹配；保守预留7元非账单。单条Seedance2.5反应镜头提交，预留8元。后续红痕/反应以固定图轻推近降低购买时长。
- 无业务源码更改；单次执行脚本语法已检查。下一命令读/tmp/30s-reaction.log和/tmp/30s-tts-rest.log，成功后做新视频、完整对白ASR与合成字幕检查。关键计划docs/productions/do-not-open-30s-v01/EP01/plan.json及edit-plan.v02.json。

## 原创30秒样片 v03 已输出（2026-09-21）
- 六镜30秒720×1280成片完成；新增Seedance2.5反应视频1条、MiniMax七句对白、imagegen腕部图1张，复用已验证换手/反锁素材，其他镜头静图运镜。不是全动态或一键产品验收。
- 修复中文字幕缺字，第二镜改人物听声反应避免连续门锁画面拖沓。全片解码/黑场/中文画面检查通过，最终PCM与ASR证据同源。混音“锁好了”识别歧义，干声正确；主观完整听审、真实观众反馈未完成，不宣称精品或商业通过。
- 200后端、19前端、语法、Vue构建、隔离启动HTTP冒烟通过；无typecheck，大包警告非阻断。没有新增业务源码变更。
- 新接口预留15元非账单，图片工具费用未知，历史复用成本另计；没有付费重试。
- 关键文件docs/productions/do-not-open-30s-v01/EP01/qc_report.v03.md、edit-plan.v03.json；成片data/production/do-not-open-30s-v01/do-not-open-30s-v03.mp4。下一步按报告进行5至10人方向性测试，先验证钩子再扩片；下一命令读取该报告和budget-ledger.json，避免重复生成。

- 30秒样片v03浏览器实播至结束，ended=true、error=null。预览：http://127.0.0.1:5689/static/reviews/sample-30s-v03/index.html；完整结论见docs/productions/do-not-open-30s-v01/EP01/qc_report.v03.md。

## 2026-09-26 角色配音契约与视频前分镜检查
- 完成：角色卡新增独立TTS供应商/音色ID保存，数据库自动补列。工作台按对白角色名（或唯一出场角色）绑定音色；旁白使用TTS配置的独立默认音色，对白/旁白分别生成。多人、未知说话者、供应商不匹配、缺少音色先阻断，要求拆镜/补配置。
- 视频参考音色不再取全剧第一个：只匹配明确说话者；无对白不自动注入；已有参考但目标角色缺参考时报错。未配置任何参考的旧原生视频模式仍可运行，不能宣称音色锁定。
- 工作台真实视频提交前检查所有镜头的景别、机位、运镜、场景、动作、结果、光影、有效时长；音色计划也在提交前解析，缺项不产生视频付费请求。当前为结构完整性检查，不证明内容合理性；传统独立生成入口没有全量接入此门禁。
- 移除TTS调试日志中输出API密钥的语句。既有音轨不覆盖，设置变更仅影响新生成；多角色单镜自动分段配音、音色试听及旧音轨自动失效仍待实现。
- 验证：全量205后端通过，新增数据库持久化用例后单独5项契约测试通过；19前端通过，Vue构建通过，JS语法/git diff检查通过，隔离Mock HTTP启动冒烟通过。纯JavaScript无typecheck；大包警告仍非阻断。本轮付费调用0。
- 正式5679已用Node22重启，health正常，页面HTTP200。测试日志/tmp/voice-backend.log、voice-contract.log、voice-front.log、voice-build.log、voice-smoke.log。首次全量测试旧fixture缺字段失败，按新契约补齐并新增零提交反例后通过。
- 关键文件：productionVoiceContract.js、agentProductionService.js、videoClient.js、characterLibraryService.js、db/migrate.js、FilmCreate.vue；测试productionVoiceContract.test.js、agentVideoReview.test.js。
- 下一步命令：读取本节与git diff，再验证角色试听/多说话者分段设计，将完整性门禁统一到其他生成入口；不要以结构检查替代图像、动态动作与主观声音审核。

## 2026-09-26 瑾阳公主60秒正式文本制作包
- 用户确认素材授权并批准60秒设计；新增docs/productions/jinyang-counterattack-v01，正式剧本、角色卡、系列规则、10镜结构化分镜、70项Mock依赖任务及QC。未改旧项目、未提交付费请求。
- 补充匕首右腰来源、右手夺刃→落地→右手抽刀的状态链；保留脚镣/木枷，不展示性化或血腥画面。对话按4字/秒+0.5秒逐句校验，角色锁在四处提示词逐字复用。
- 验证命令python3 docs/productions/jinyang-counterattack-v01/validate.py通过：总时长60、10镜、对白区间、角色锁、70任务唯一ID与无环依赖；仅文档与制作数据，无业务代码修改，未重复应用测试。媒体/合成检查PENDING，未宣称成片验收。
- 当前阻塞：S003双人对白不能直接走现有单说话者自动配音入口，需要分轨；音色、供应商、模型、本项目预算未确定，全部真实任务禁用。新资料未导入生产数据库，不声称工作台已有新项目。
- 下一步：读取该项目EP01/qc_report.md与mock_media_tasks.json，再按独立分轨路径处理S003和确定媒体执行合同。关键文件EP01/script.md、EP01/storyboard.json、character_bible.md、validate.py。

## 2026-09-26 瑾阳项目接入工作台
- 通过现有POST /api/v1/dramas/import事务导入，新项目5、剧集9；未改旧项目4。7角色、2场景、4道具、10镜60秒，角色/场景/道具ID由平台重映射。原始分镜合同保留在continuity_snapshot，内心旁白与对白分别映射。
- 隔离内存数据库导入验证通过：7角色、10镜、60秒、视频任务0；正式API回读与agent-browser页面确认剧本、角色7/道具4/场景2/分镜10和关联可见。无业务代码变动，无付费生成。日志/tmp/jinyang-import-test.log。
- 页面http://localhost:5679/film/5?episode=9。此为项目制作页导入，不伪造Agent运行记录或审批。音色与媒体未生成；S003多说话者仍待分轨。页面当前合成分辨率默认480p，正式制作前应明确改720p，不能将文档目标视作所有控件已生效。
- 下一步读取项目5与原制作包，选择音色并处理S003分轨，确认本项目生成范围与预算后才提交媒体。

## 2026-09-26 押送兵时代错配修正与技能沉淀
- 根因证据：角色19已保存polished_prompt明确含立领、双排扣、帽檐、裤中缝和系带靴；外貌仅写赭色军服，润色引入近现代服制。不是只有模型随机偏差。
- 通过正常API更新角色19外貌、完整生图提示词及negative_prompt：架空古代交领右衽、札甲、布巾包髻、绑腿布靴。取消错误图主参考local_path/image_url，原文件与生成历史保留，未重生图；同步分镜74/75的相关提示词。新版资料versions/soldier-era-correction.v02.json、storyboard.era-v02.json，旧文本不覆盖。
- ai-comic-director技能新增时代/服制规则、润色前后检查、缓存与旧资产失效、错例和验收边界；output-contracts补era_context/costume_rules/forbidden_anachronisms。属于技能工作流约束，未声称应用新增自动视觉识别能力。
- 验证：技能quick_validate通过；数据库回读角色/两镜提示词、错误主参考取消、旧图文件保留断言通过；health正常、git diff检查通过。仅数据/文档/skill修改，无应用源码变更，不重复业务单测和构建。付费调用0。
- 当前图片仍待重生成与实际审核，不能称新造型已验收。下一步在确认本项目真实生图授权范围后生成一张押送兵参考，按时代/服制/装备三项审核，通过再用于下游。

## 2026-09-26 角色编辑联动与中文模板
- 修复弹窗直接“重新生成提示词”读取数据库旧描述的问题：先保存当前名称/外貌/简介并清空旧提示词，再按当前画风生成、回填并保存；增加“更新提示词并重新生图（消耗额度）”连续操作。文字失败停止，不降级后偷偷买图；无任务ID时只有图片路径变更才认作新结果，保留旧素材。
- 角色润色与布局模板统一简洁中文四视图，取消工业标题/英文标签/材质分栏；主角/反派/客串枚举增加中文展示。项目5六个仍使用英文模板的角色按当前外貌转换中文提示词，押送兵修正版保持。原提示词备份/tmp/project5-prompts-before-chinese.json。未触发AI/图片付费调用。
- 回归206后端+21前端通过，包含模拟最新输入保存顺序及文字失败零生图；Vue构建、JS语法、git diff检查、Mock隔离启动HTTP冒烟通过。无typecheck，保留构建大包警告。正式5679已重启，health正常，项目5页面可打开。
- 本轮不实现整剧级自动覆写：人物视觉锚点、历史图/视频、相关分镜已有人工编辑不会自动重写；角色再设计和多模态成品审核仍独立。按钮调用配置的模型会消耗额度，不保证生成审美质量或任何模型绝不输出英文。
- 关键文件promptI18n.js、characterLibraryService.js、useCharacters.js、FilmCreate.vue、characterPromptRefresh.test.js；日志/tmp/prompt-chain-*.log。下一步对已生成资产增加显式待重审和局部重跑界面，避免误把旧资产当作新版本。

## 2026-09-26 角色描述分类恢复
- 姜瑾输入按时代身份、年龄体态、脸型五官、发型发饰、服装配色、材质磨损、气质表情、禁止项分段；简介按背景、行为、表演分段。保留新造型内容，不再混成长段。旧灰蓝粗布裙polished_prompt已清空，旧值保存在/tmp/role-sections-current.json，图片未改。
- AI角色润色模板要求九个独立中文标题及空行，明确标题只用于提示词编辑、不画入图中。实际AI新输出尚未调用，不宣称已生成新提示词或图像。
- 206后端/21前端、构建、语法、git diff、Mock启动冒烟通过；无typecheck，大包警告非阻断。5679已重启，health正常，付费调用0。下一步用户按分类修改后点击保存描述并更新提示词。

## 2026-09-26 一句话AI角色资料自动填充
- 新增角色编辑“AI设计角色”入口与POST /characters/:id/ai-draft。根据用户一句话、未保存的当前输入及本剧前三集限长文本，调用文字模型生成结构化设定；程序统一中文分类，外貌与生图提示词同源，自动填充简介和负面词。结果先进入表单，保存后采用，可撤回本次填充。
- 错误JSON/缺字段拒绝，不写数据库；生成期间切换角色/关闭弹窗/修改核心输入不覆盖；更换角色清空前一次修改要求与撤回缓存。不会自动生图、重写其他角色/分镜。当前支持已有角色，新增角色须先保存。
- 验证208后端/21前端通过，新增Mock AI上下文、同源提示词、数据库不提前写入及错误JSON测试。Vue构建、语法/差异检查、隔离HTTP冒烟通过；无typecheck，大包警告保留。5679已重启，浏览器实见新按钮与撤回入口，health正常。本轮没有真实模型调用，未声称真实AI审美质量通过。
- 关键文件characterDraftService.js、characterDraftService.test.js、characters路由/API、useCharacters.js、FilmCreate.vue。下一步用户在角色编辑一句话输入后生成并检查，正式文字生成会消耗已配置文字模型额度；场景/道具的同类入口未在本轮扩展。

## 2026-09-26 全角色重制首版生成
- 用户补齐具体供应商/数据/费用授权后执行：独立项目6/剧集10，DeepSeek配置文字生成7人资料，Seedream4.5图片7个任务105—111全部完成；无付费重试，未生成视频。费用待结算，不报虚构数字。
- 已逐张总览审核：女主/出卖者脚部裁切、赵校尉侧视重复、周雎木枷错误；寺人监/胥郎/押送兵仍有局部一致性疑点。首版候选不放行下游。报告docs/productions/jinyang-rebuild-v01/qc-first-pass.md。
- 每次请求前写started记录，回执和AI资料存data/production/jinyang-rebuild-v01。旧项目5保留。下一步针对候选问题制定局部修正；现有单次授权不自动付费重试，项目6分镜仍需同步新角色锁。无业务源码修改，本轮检查实际任务状态/文件和画面，不重复业务测试。

## 2026-09-28 角色下游同步与S002修复
- 新增characterDependencyService：角色编辑保存发生外貌/姓名/主图路径变化时，精确替换关联分镜中的旧外貌锁，保留动作对白；无法匹配的字段标冲突。分镜记录角色指纹，图片提交与视频处理前检查版本，冲突阻断。已使用的图片/视频解除主引用、历史路径记录到dependency state，文件与生成历史保留。
- 项目6已备份before-character-sync-20260928.db；10镜按初始制作包旧锁与当前角色卡同步。首轮发现continuity_snapshot已被别的流程改为对象格式，改从原始版本文件取精确旧锁；未模糊覆盖。三个旧润色缓存归档后清空，不与新文本混用。
- S002明确姜瑾独自触碰自己右脚踝，移除周雎木枷、其他人物腿脚和无关道具关联；旧错误图解除主引用，不买新图。10镜版本检查通过。
- 209后端/21前端、Vue构建、语法/git diff/隔离HTTP冒烟通过。首次插入守卫位置错误导致1测试失败，调整至视频任务处理try入口后通过。纯JS无typecheck，构建大包警告保留。5679已重启health正常，本轮付费0。
- 关键文件characterDependencyService.js/test、characterLibraryService.js、storyboardService.js、imageService.js、videoService.js、migrate.js、FilmCreate.vue。当前旧图未获重新验收；新增警示标签不代表新媒体通过。自动联动覆盖角色编辑保存路径，直接批量SQL或其他绕过保存服务的修改由指纹守卫拦截，需同步后继续。

## 2026-09-28 旧分镜历史回退修复与女主分镜重生成
- 已复现：清空storyboards主图后，FilmCreate仍从images列表取最新历史完成图。新增失效时间invalidated_at；默认图片列表排除在此时间之前创建的记录（含当时尚未完成任务），include_stale=true可审计历史，原记录/文件不删除。补齐drama详情角色依赖状态字段。
- 新增staleStoryboardImages回归先红后绿；210后端/21前端通过，JS语法/前端正式构建/git diff/隔离Mock HTTP冒烟通过。无typecheck脚本，构建大包警告保留。第一次构建误在根目录执行，已删除该次单文件dist并在frontweb目录重新构建通过。
- 项目6十镜补失效时间；浏览器刷新证实原旧图不再作为当前结果。用户授权付费后限定女主出镜7张Seedream4.5任务124—130，无视频、无付费重试。初次提交因本地服务未启动被拒绝，核对数据库无任务后启动持续服务再提交；该连接失败无供应商请求。
- S002/124已完成，浅青交领造型恢复且触碰自身脚镣；坐姿裙面疑似裤管，暂为待复核候选。其余六张等待结果。请求/回执记录data/production/jinyang-rebuild-v02，费用待供应商结算，不能虚报。
- 下一步：回读任务125—130并逐张视觉复核，写入该目录结果与docs/productions/jinyang-rebuild-v01新QC；刷新工作台检查结果。不将API completed当作艺术审核通过。
- 关键文件characterDependencyService.js、imageService.js、dramaService.js、test/staleStoryboardImages.test.js；测试日志/tmp/refresh-*。
- 完成补记：124—130七张全部生成成功并逐张视觉检查，女主新造型恢复；剧情审核未通过（巨型脚镣、木枷、动作/额外手问题），详见qc-storyboards-v02.md。不购买这些候选的视频。S003—S005本轮不含女主，未付费重做，仍保持旧素材失效状态。下一步先修道具参考及周雎木枷上游，再局部重跑；不能把七张新候选称为最终成片验收。

## 2026-09-28 荒道押送状态 v03
- 用户确认统一押送状态方案后，使用Codex imagegen编辑已有人物图；保留五官/年龄/浅青服装，增加固定袖口、膝部、裙摆和领缘灰泥，脸颊擦灰、疲态与松散鬓发，无血与新增重伤。此次是imagegen工具编辑后导入，不是火山Seedream付费API；实际工具模型/计费未提供，不虚报。
- 项目6角色20基础资料及7镜已完整备份data/production/jinyang-escort-v03/before.json。场状态scene-state.json独立版本保存，并写入各镜continuity_snapshot.scene_states；通过角色保存服务联动旧媒体失效，图片/视频/布局等提示词继承当前状态，动作对白断言保持不变。原图保留。
- 状态参考及S002近景、S006全身已实际生成并视觉复核：污损明显、角色与配色保留，小脚镣尺寸正常；两样张已导入工作台。剩余5镜同参考编辑处理中。此为当前项目数据落地，未声称已有通用场状态编辑面板。
- 210后端、21前端、JS前端构建、隔离Mock启动HTTP冒烟通过；纯JS无独立typecheck脚本，构建大包警告保留。下一步接收5图逐张视觉检查、导入并验证浏览器刷新，整理本轮QC。无视频生成。
- 完成补记：状态参考1张、分镜7张全部导入；S008生成时加鞋，独立局部修正1次后恢复赤脚，历史135保留、当前138。实际imagegen调用9次（1参考+7镜+1修正），无火山API新请求/无视频。当前7镜指纹/状态/14份提示词/解码分辨率检查通过；浏览器刷新全部加载。QC为docs/productions/jinyang-rebuild-v01/qc-escort-v03.md；后续完整动作/精确污痕侧别仍未验收，不能宣称成片完成。下一步命令：node backend-node/data/production/jinyang-escort-v03/verify.cjs（使用Node22）；优先审核镜头动作及光向后才购视频。

## 2026-09-28 全员押送状态 v04
- 逐人对照原文与已确认剧本，7人更新状态参考：女主赤脚，周雎宽木枷与双肩囚衣，出卖者长裙及脚镣，宫监统一绿袍，官兵自然行军磨损而非统一加伤，胥郎修露肩/眼妆但不加入本集分镜。
- 18次imagegen调用（7角色初版+2角色修正+3新分镜+6分镜局部修正），采用7角色卡；分镜9张新/修正＋1张复用。没有火山API新请求及视频生成，工具具体模型/金额未返回，不报零费用。首轮出卖者短片裙及士兵侧脸问题经局部修正；S006—008刀鞘露刃、S010露肩、S001/009出卖者服制同步修正。
- data/production/jinyang-cast-v04已备份全部7角色10镜；保存服务联动失效后重新审核绑定。10镜继承角色状态和新参考，动作对白不变；旧素材保留。本轮是项目数据修正，没有声称新增通用场状态UI。
- 验证210后端/21前端、构建、制作脚本语法、隔离Mock启动HTTP冒烟、生产health通过；纯JS无typecheck，大包警告非阻断。7卡10镜指纹/引用/20提示词/解码/720p与16:9校验通过，浏览器可加载新素材。
- 当前问题：四视图个别角度相近、局部污痕/镣铐纹样仍有差别；S007为持刀结果帧，不能当作取刀起始帧；完整动作、配音与成片尚未验收。报告docs/productions/jinyang-rebuild-v01/qc-cast-v04.md。
- 下一步命令：/opt/homebrew/opt/node@22/bin/node backend-node/data/production/jinyang-cast-v04/verify.cjs。后续模块锁定S006—009动作起止与手部/兵器状态，再做有界视频样片。关键文件为该目录states/refs/shots、apply/import/import-s009/verify及QC报告。

## 2026-09-28 服务恢复与动作v05推进
- 用户报告无法访问，检查5679无监听；旧日志末尾正常GET、无退出原因记录，不能断言代码崩溃。使用本机Node22恢复，health正常。新增scripts/start-local.command及docs/local-service.md，支持终端启动/重复启动保护/SQLite与前端预检，保持终端开启；不宣称已有系统守护或开机自启。
- 启动器语法、重复启动分支和health实测通过；210后端/21前端、前端构建与隔离Mock启动HTTP冒烟通过。纯JS无typecheck，大包警告保留。仅测试环境第一次curl被沙箱隔离，授权环境重复验证成功，非服务二次故障。
- 后续校准S006—009起止状态，角色卡不变。S007不再以持匕首结果充当空手首帧；当前首150、尾151，S008首152继承持刀状态。动作及提示词、continuity_snapshot.action_contract已版本化，原4镜备份data/production/jinyang-action-v05/before.json，对白保留。
- S007 Seedance2.5 6秒720p初次视频45被HTTP400拒绝camera_fixed，无供应商任务ID。按真实错误修复官方2.5首尾帧请求删除该参数（其他模式保留），增加实际请求体Mock回归；211后端通过。测试首轮同图去重导致夹具错误，改用不同首尾图后验证正确路径。已重启修复服务。
- 纠正参数后唯一受理视频46，provider_task_id=cgt-20260928154655-d4ibf，实际model=doubao-seedance-2-5-260628；尚在生成，不声称通过、不自动批量。请求/回执均保留，无密钥输出；金额待供应商结算。S008/009尾帧正在局部编辑。
- 下一步：查询46现有任务，抽帧核对真实取刀/手别/多生兵器并播放；接收尾帧逐张审核后绑定。关键文件videoClient.js、volcengineVideoBody.test.js、action-v05制作目录。

- 完成补记：46已完成，6.048秒，原生720p由平台放大1440p；技术通过但拔刀路径不清晰，连续物理动作未通过。本地剪辑候选切赵反应，完整播放正常且音轨hash一致；保留原片。S008/009尾帧153/154绑定，四镜指纹与对白断言通过。S009侧倒及长刀形制待核对。详细qc-action-v05.md。
- 最后health/启动器重复启动保护通过；211后端/21前端、构建/隔离冒烟通过。下一步校正S009动作与尾帧及兵器、确定S007分切合同；后续视频/音轨/字幕/全片听审未完成。重启见docs/local-service.md。

## 2026-09-28 动作v06修正与60秒合成
- 用户授权修正验收后合成：完成S009侧倒尾155、S010长刀首156；9次Seedance2.5任务47–55全部完成，无自动重试，共1174500tokens待账单；2次imagegen。S007复用46独立剪辑，S005明确反应切点。未使用2.0/mini。
- 10镜统一720p24fps、原生对白、中文字幕及末尾切黑，实际60.019秒；合成记录5/episode10已回填，标题“待音色听审”。原素材及版本保留。最终文件jinyang-EP01-action-v06c-720p.mp4，SHA b7066a812e9801f7b3d4b6ab8874a483bb52ca106851f7e07e681a48b4c16029。
- 211后端/21前端、构建、语法、Mock启动冒烟通过。纯JS无typecheck，既有大包警告保留。字幕方框经显式中文字体及真实family名称修复，抽帧验证；音视频全解码及逐段ASR通过执行，不等于主观听审通过。动作主要结果成立，局部裁切较软/污痕口型微差；完整音色情绪未认证。QC详见qc-action-v06.md。
- 关键文件action-v06的prepare/import/submit/inspect/transcribe/assemble/export-v3/register，源记录与技术报告均本地保存。下一步只读复核已导出版本声音与表演，不重复运行submit（已防重），不把导出completed当内容PASS。
- 最终v06c浏览器完整播放ended=true、60.018667秒、error=null；工作台路由可打开。black-v3记录最终版本，未将旧版播放结果套用新文件。

## 2026-09-29 前端商业化重构（进行中）
- 新增统一工作室导航与灰白/青绿设计规范，项目列表改为独立操作区、搜索/排序、清晰卡片与空状态；素材库、导入/导出/编辑/删除保留。创作入口、制作页与总控初步统一；移除旧主题的紫色渐变增强层及全局文本颜色覆盖。
- 已通过前端23测试（新增目录搜索/排序/不变性2项）、后端211测试；首次构建通过。纯JS无typecheck。浏览器实际6项目搜索“亡国”返回2项，制作页与总控可加载，无浏览器错误。制作数据与付费API未改动。
- 当前：第二轮校正锚点遮挡、深浅主题与窄屏布局，最终构建/冒烟待完成。一次构建写文件路径使用了错误cwd，已更正；既有Vite大包警告。
- 下一命令：cd frontweb && npm run build；node --test test/*.test.js；node scripts/smoke.cjs（根目录）。关键文件StudioNavigation.vue、styles/studio.css、theme.css、FilmList.vue、DirectorCreate.vue、AgentWorkbench.vue、FilmCreate.vue；计划docs/frontend-redesign/plan.md。
- 前端模块完成补记：最终23前端/211后端、JS语法、Vue构建、diff检查、隔离Mock HTTP冒烟通过，5679health=ok。浏览器实测搜索/空态/名称排序/进入项目/编辑和素材弹窗/示例填充；390px六页面无页面级横向溢出，画布仍独立导航。修复旧最小460px角色网格、长复选框溢出、窄屏导航无法展开、提示词近白文字对比度。未写生产业务数据、未调用付费API。
- 当前报错：无阻断；既有Vite大包警告保留。源码兼容层保留大型历史组件，未声称完成所有业务模块拆分。验收/截图docs/frontend-redesign/acceptance.md。新版dist已服务，下一步命令：bash scripts/start-local.command；打开http://localhost:5679/projects（已运行时直接刷新）。
