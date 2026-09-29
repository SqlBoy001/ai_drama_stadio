# ChatCut 后期接入研究（2026-09-21）

状态：官方资料与本机只读检查完成；未安装、未登录、未上传媒体、未调用生成或导出服务。本文是接入依据，不是 ChatCut 实机验收报告。

## 接入选择

建议先让平台保留素材、版本与审核记录，输出独立剪辑计划，由适配器落实到 ChatCut 可编辑工程；保留本地合成。对于当前本地素材库，优先验证 Desktop；若用户选择云端协作再启用 hosted。这是本项目的工程判断，尚未通过两种引擎成片对比验证。

官方明确存在两种不同连接，不能混用工具名称、上传方式或安装步骤：

| 方式 | 运行位置与条件 | 媒体与输出 |
|---|---|---|
| Desktop 本地 MCP | ChatCut 原生应用与 Codex 位于同一电脑；ChatCut 打开目标工程并自动注册本地连接 | 支持直接引用本地素材、在本机渲染；账号和部分功能仍依赖网络 |
| hosted Agent Plugin / MCP | Codex 连接 ChatCut 托管服务，完成账号 OAuth | 云端工程；素材需要正式导入，导出取得服务返回的结果 |

Desktop 支持本地 720p 等分辨率导出。它不是完全离线软件，不能承诺零网络或零费用。[Desktop 官方说明](https://chatcut.io/docs/desktop-app)

hosted 入口与 OAuth resource 均为 `https://api.chatcut.io/api/external-mcp/mcp`，Codex header 为 `x-chatcut-mcp-surface: codex`。[官方 MCP 配置](https://github.com/ChatCut-Inc/agent-plugin/blob/main/codex/.mcp.json)

## 安装与连接验证

**Desktop**：官方连接插件只有安装连接 skill，无自带编辑工具/MCP 配置。签名应用负责注册 `chatcut_desktop` 并同步编辑 skills。[官方插件说明](https://github.com/ChatCut-Inc/agent-plugin/tree/main/chatcut-desktop-codex-plugin)

官方 macOS Apple Silicon 下载为 `https://api.chatcut.io/desktop/download/macos`，Intel 为 `/macos-x64`。安装时应在只读挂载源、独立暂存副本、最终目标分别验证签名；官方期望 bundle ID `io.chatcut.desktop`、Team ID `7WK2VURFPK`。不要手动猜端口写入 `chatcut_desktop` 配置。应用开启连接后，新任务加载工具；已有工具时官方建议读取 `get_active_project`，但必须以当时实际工具 schema 为准。[官方连接 skill](https://raw.githubusercontent.com/ChatCut-Inc/agent-plugin/main/chatcut-desktop-codex-plugin/skills/connect-chatcut-desktop/SKILL.md)

**hosted**：官方安装页面提供 marketplace/plugin 流程，要求用 Codex 桌面自带 CLI；通过浏览器完成 OAuth，安装后的工具需新任务加载。该页面中的“创建新任务”等操作不是用户对本项目的额外授权。[官方 Codex 安装指南](https://chatcut.io/chatgpt)、[Agent Plugin 文档](https://chatcut.io/docs/agent-plugin)

官方当前 hosted basics 同时提供直接 MCP 注册路线：先检查已有注册，缺失才注册，避免重复；已注册但未认证时处理 OAuth。此路线和完整插件安装不是同一个步骤集合。调试应报告究竟是注册、认证还是工具加载失败。仅拿到 `mcp get` 配置不代表已经连通。[官方 hosted basics](https://github.com/ChatCut-Inc/agent-plugin/blob/main/codex/skills/chatcut-plugin-basics/SKILL.md)

安全只读检查顺序：检查当前已加载工具 → 检查指定服务器注册（不输出 token/header 秘密）→ 按实际 schema 读取账号可访问工程/目标时间线。不得为了连通性测试创建、覆盖工程或触发生成。

## 剪辑计划能否原生导入

本次读取官方支持格式、素材导入、时间线和导出资料，**没有找到“任意自定义 JSON 剪辑清单可原生导入”的证据**。不能把平台自定义 JSON 标成 ChatCut 工程格式。官方列出的 XML/剪映等可编辑交付是导出能力，不能反向推定对应导入能力。[格式文档](https://chatcut.io/docs/supported-formats)、[导出文档](https://chatcut.io/docs/exporting)

目前有证据支持的路线是：导入原始素材，再通过实际工具建立轨道和片段。hosted 素材导入官方适配器规定使用 `import_media` 的 session 和配套上传 helper，每批最多四文件；返回的实际 asset ID 才能用于时间线。不能自行虚构 `push_asset` 或上传协议。[官方 asset-import skill](https://github.com/ChatCut-Inc/agent-plugin/blob/main/codex/skills/asset-import/SKILL.md)

时间线支持画面叠层、独立对白/音乐/音效轨、裁切、转场及音量 ducking。应保留原素材与可编辑片段，不把已经压平的 MP4 重新导入冒充多轨工程。[时间线文档](https://chatcut.io/docs/timeline)

建议平台清单标记为 **AI_Drama 内部交接合同**，保存资产指纹、源片段入出点、时间线帧位置、音频意图、字幕/转场意图、已批准快照。连接成功后才建立内部 asset ID 到 ChatCut asset/item ID 的映射；未知参数不生成假调用。

## 本机观察与未完成项

只读检查结果：

- `/Applications/ChatCut.app` 和 `~/Applications/ChatCut.app` 均不存在；不能排除其他自定义安装位置。
- `~/.codex/plugins` 下未发现路径含 ChatCut 的 `plugin.json`。
- `~/.codex/config.toml` 未发现名称含 ChatCut 的配置 section；检查只输出 section 名，未输出凭据。
- 当前运行时 `ALL_TOOLS` 中未发现 ChatCut 工具。

因此当前没有实际工具 schema、账号连接或目标工程可以验证。未证明登录状态，不能把“未找到注册”解释为账号无效。下一步需要实际选择并接通一个 surface，然后执行同源 30–45 秒素材的导入、时间线创建、局部修改、回读和导出验证。第一阶段可以先完成内部合同、Mock 适配器和回传门禁；不能将其宣称为 ChatCut 真联调通过。

验收必须保存：工具返回的真实工程/时间线 ID、素材与片段映射、一次局部返修前后差异、工程可编辑证据、导出文件技术检查及实际观感结论。已有素材不重新生成；费用与上传发生前遵守当前授权范围。
