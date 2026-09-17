# AI Drama Stadio

面向新用户的一句话 AI 漫剧/短剧生产平台。

`auto` 新入口：`/create`（首页自动跳转）。一句话 → 缺失方向问答/推荐默认 → AI 或 Mock 方案 → 确认后进入生产审核。草稿自动保存；模型设置和旧制作页仍可使用。

零费用体验：`npm run build && npm run dev:mock`，打开 http://127.0.0.1:5681/create；使用内存数据库，退出后测试草稿不保留。正式服务的草稿保存在 SQLite 中。

本轮已验证真实文本策划，未重新跑付费图片/视频整片；Mock 不生成可播放 MP4，内容质量仍需人工审核。GPT Image 2 与 Pro/代理说明见 [文档](docs/image-provider-notes.md)。基于 [LocalMiniDrama](https://github.com/xuanyustudio/LocalMiniDrama) 1.2.8（源码基线 adaecf7）增量开发，保留原项目 MIT 许可证与署名。

- `main`：当前工作台基线；`auto`：引导式自动创作迭代。
- Node.js 22（`nvm use`），运行 `npm run setup` 安装前后端依赖。
- `npm run verify`：JS 语法检查、前后端单测、Vue 构建、无凭据隔离 HTTP Mock 闭环。没有 TypeScript 类型检查。
- 开发：两个终端分别执行 `npm --prefix backend-node run dev` 与 `npm --prefix frontweb run dev`；访问 http://localhost:3013。
- macOS 一键启动：`./start_app.command`。真实媒体合成需要 FFmpeg/FFprobe；本机二进制不纳入 Git，请安装 FFmpeg 或放入 backend-node/tools/ffmpeg。
- AI 配置在本地界面填写，数据库和生成素材不上传。Mock 不收费；真实调用单独计费。
- 进度与已知限制见 [docs/progress.md](docs/progress.md)。当前基线 Mock 导出为状态演练，不代表已产生 MP4；生成质量需单独验收。

以下保留上游项目说明。

---

<div align="center">

# 🎬 本地短剧助手

**本地 AI 短剧 & 漫剧生成工具 —— 下载即用，完全开源，数据不出本机**

*LocalMiniDrama · AI-powered short drama creator*

[![version](https://img.shields.io/badge/version-1.2.8-blue?style=flat-square)](https://github.com/xuanyustudio/LocalMiniDrama/releases)
[![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=flat-square)](#-快速开始)
[![stack](https://img.shields.io/badge/Vue3%20%2B%20Node.js%20%2B%20Electron-informational?style=flat-square)](#-项目架构)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/xuanyustudio/LocalMiniDrama/pulls)

**[English](docs/en.md) · 简体中文 · [作者故事](docs/story.md)**

[![GitHub](https://img.shields.io/badge/GitHub-xuanyustudio%2FLocalMiniDrama-181717?logo=github&style=flat-square)](https://github.com/xuanyustudio/LocalMiniDrama)
[![Gitee](https://img.shields.io/badge/Gitee-bi__shang__a%2Flocalminidrama-C71D23?logo=gitee&style=flat-square)](https://gitee.com/bi_shang_a/localminidrama)
[![AtomGit](https://img.shields.io/badge/AtomGit-xuanyustudio%2FLocalMiniDrama-0052D9?style=flat-square)](https://atomgit.com/xuanyustudio/LocalMiniDrama)

[**⬇️ 下载 Release**](https://github.com/xuanyustudio/LocalMiniDrama/releases) · [**🚀 快速开始**](#-快速开始) · [**📖 配置 AI**](docs/configuration.md) · [**🗺 画布文档**](docs/plans/2026-06-15-drama-canvas-workflow-plan.md)

</div>

---

<table>
<tr>
<td width="25%" align="center"><b>🔒 本地优先</b><br/>SQLite + 本地文件，素材不上云</td>
<td width="25%" align="center"><b>🎬 全流程</b><br/>剧本 → 角色/场景 → 分镜 → 视频合成</td>
<td width="25%" align="center"><b>🤖 多模型</b><br/>通义 / 火山 / 可灵 / Gemini 等</td>
<td width="25%" align="center"><b>🗺 双视图</b><br/>列表精细编辑 + 画布批量编排</td>
</tr>
</table>

市面上 AI 短剧工具不少，但真正能**本地离线运行、开箱即用、素材不上云**的几乎没有。  
本项目用纯 JavaScript 从零搭建，接入你自己的 AI API，打开即可生成完整 AI 短剧。

> ✅ 无订阅费 · ✅ 数据本地存储 · ✅ 支持多家 AI 服务商 · ✅ 完全开源可二次开发

---

## 📌 最新动态（v1.2.8）

- 🆕 **Agnes AI 接入**：文本 / 图片 / 视频一键配置，一个 Key 覆盖全流程
- 🆕 **画布模式增强**：剧本节点、右键菜单、浮动工具栏、画布内新建/删除/整集生成
- 🆕 **ModelArk 私有资产库**：SD2 角色认证对接火山方舟资产组，AK/SK 与 Bearer 双鉴权
- 🔧 **图床可配置**：`upload_url` / 超时（默认 180s）/ 重试次数写入 `config.yaml`；缓存 URL 失效自动重传
- 🔧 **提示词优化** · **分镜图片数量上限修复**

完整记录 → **[CHANGELOG.md](CHANGELOG.md)**

---

## 目录

- [界面预览](#-界面预览)
- [核心功能](#-核心功能)
- [快速开始](#-快速开始)
- [AI 服务商](#-ai-服务商支持)
- [项目架构](#-项目架构)
- [后续计划](#-后续计划-roadmap)
- [参与贡献](#-参与贡献)
- [联系社区](#-联系--社区)

---

## 📸 界面预览

<div align="center">
  <img src="项目截图/首页截图.png" alt="首页 · 项目列表" width="960"/><br/>
  <sub>首页 · 项目卡片一览，亮色模式</sub>
</div>

<br/>

<div align="center">
  <img src="项目截图/画布模式.png" alt="画布工作流 · 分镜流水线" width="960"/><br/>
  <sub>🆕 画布模式 · 分镜流水线可视化 · 节点内编辑/生成 · 工作流整组重跑</sub>
</div>

<br/>

<table>
  <tr>
    <td align="center"><img src="项目截图/武侠.png" alt="剧集管理页" width="480"/><br/><sub>剧集管理 · 分集 + 资源库</sub></td>
    <td align="center"><img src="项目截图/武侠分镜.png" alt="分镜编辑页" width="480"/><br/><sub>分镜制作 · 图片 + 视频一键生成</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="项目截图/新版本4宫格分镜.png" alt="角色管理页" width="480"/><br/><sub>角色生成 · AI 自动提取并生成角色形象图</sub></td>
    <td align="center"><img src="项目截图/专业分镜.png" alt="专业分镜参数" width="480"/><br/><sub>分镜制作 · 专业视频参数（景别 / 运镜 / 灯光 / 景深）</sub></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><img src="项目截图/本剧场景库.png" alt="本剧场景库" width="720"/><br/><sub>场景库 · 一键「加入本集」，复用已有场景素材</sub></td>
  </tr>
</table>

---

## 🎬 AI 生成实拍效果

> 以下 3 段视频由**本软件自动工作流选择即梦 1.0**生成，展示连续分镜下角色外貌一致性。

<table>
  <tr>
    <td align="center">
      <video src="项目截图/1.mp4" controls width="300"></video><br/>
      <sub>分镜 1 · 即梦 1.0</sub>
    </td>
    <td align="center">
      <video src="项目截图/2.mp4" controls width="300"></video><br/>
      <sub>分镜 2 · 服装一致</sub>
    </td>
    <td align="center">
      <video src="项目截图/3.mp4" controls width="300"></video><br/>
      <sub>分镜 3 · 人物统一</sub>
    </td>
  </tr>
</table>

> 💡 同时支持火山 **Seedance 2.0**、通义万相、Vidu、可灵 Kling（含 Omni）等，模型越新效果通常越好。

---

## ✨ 核心功能

<details open>
<summary><b>🔄 完整创作流程（点击展开/收起）</b></summary>

| 步骤 | 功能 | 说明 |
|:----:|------|------|
| 1 | **故事生成** | 输入梗概 + 风格，AI 自动生成多集剧本 |
| 2 | **剧本编辑** | 分集管理，剧本文本可自由编辑 |
| 3 | **角色生成** | AI 提取角色列表，逐个生成角色形象图 |
| 4 | **场景生成** | 从剧本自动提取场景，生成场景背景图 |
| 5 | **道具生成** | 从剧本提取/手动添加道具，生成道具图 |
| 6 | **分镜生成** | 按集自动生成分镜脚本（含景别/运镜/台词） |
| 7 | **图片/视频生成** | 逐镜生成静帧图与视频片段 |
| 8 | **合成视频** | 所有分镜视频自动合成为完整剧集文件 |

</details>

<details>
<summary><b>⚡ 一键流水线 · 项目管理 · 分镜编辑</b></summary>

- **一键生成 / 补全并生成**：从角色到合成视频全自动；智能跳过已有内容
- **失败自动重试**：每步最多 3 次，应对限流；实时进度与错误日志
- **工程 ZIP 导出/导入** · **全局素材库** · **16:9 / 9:16 / 1:1 画幅**
- **经典 / 全能分镜** · **`@图片N` 多图参考** · **尾帧衔接** · **导出分镜表 HTML**
- **图片/视频提示词**全文编辑 · 手动上传/拖拽替换参考图

</details>

### 🗺 画布工作流（LibTV 式）

制作页 / 剧集详情 → **画布模式**（`/film/:id/canvas`），与列表模式**同源数据**：

| 能力 | 说明 |
|------|------|
| 竖排流水线 | 每镜一行：经典「文本→首帧/尾帧→视频」；全能「全能分镜词→视频」 |
| 剧本节点 | 画布起点直接编辑剧本、AI 生成故事、提取角色/场景/道具 |
| 节点操作面板 | 单击节点下方编辑/生成，无需频繁切列表 |
| 右键 / 工具栏 | 新建分镜、集、角色、场景、道具；框选创建工作流 |
| 工作流组 | 框选分镜 → 创建工作流 → **整组重跑**（生图/视频/配音可勾选） |
| 布局持久化 | 拖动保存坐标；曲线连线；左键框选、中键/右键平移 |

界面预览见 [上方截图](#-界面预览) · 📖 [画布工作流完整文档](docs/plans/2026-06-15-drama-canvas-workflow-plan.md)

### 🤖 AI 配置 · 🌓 亮/暗主题 · 自定义提示词

三类模型独立配置（图/视频/文本）；一键配置通义/火山；9 类提示词可自定义覆盖。

---

## 🚀 快速开始

### 方式一：下载 exe（推荐）

前往 **[Releases 下载页](https://github.com/xuanyustudio/LocalMiniDrama/releases)**：

| 版本 | 说明 | 适合 |
|------|------|------|
| `本地短剧助手 x.x.x.exe` | 标准版，**含示例项目** | 新手入门 |
| `本地短剧助手-Lite-x.x.x.exe` | Lite 版，体积更小 | 熟悉流程后 |

双击运行 → 「AI 配置」填入 API Key → 开始创作。

> 首次运行配置：`%APPDATA%\LocalMiniDrama\backend\configs\config.yaml`

### 方式二：源码开发

> Node.js ≥ 18

```bash
git clone https://github.com/xuanyustudio/LocalMiniDrama.git
cd LocalMiniDrama

# 后端（端口 5679）
cd backend-node && npm install
cp configs/config.example.yaml configs/config.yaml   # 填入 API Key
npm run migrate && npm start

# 前端（端口 3013，新终端）
cd frontweb && npm install && npm run dev
```

浏览器打开 `http://localhost:3013`，或双击根目录 **`run_dev.bat`** 一键启动。

📖 [详细开发/打包/Docker 指南](docs/quickstart.md) · [AI 配置指南](docs/configuration.md)

### AI 短剧自动化工作台

首页点击「AI 自动短剧」，或直接访问 `http://localhost:3013/agent-workbench`。

macOS 推荐直接双击项目根目录的 `start_app.command`，或在终端运行：

```bash
cd /Users/shenzihao/Documents/ChatGPT/AI_Drama
./start_app.command
```

脚本会自动选择 NVM 中的 Node.js 22（兼容时回退到 Node.js 20），检查并修复 `better-sqlite3` 的 Node ABI，按需安装依赖、构建前端并打开 `http://localhost:5679/agent-workbench`。不再需要手动执行 `nvm use`、切换子目录或运行 `npm start`。

如果只想检查本机运行时，不启动服务：

```bash
./start_app.command --check
```

第一次跑真实 Demo：

1. 在「AI 配置」分别配置文本、角色/场景图片、分镜图片和视频模型；配音为可选项。
2. 打开「AI 自动短剧」，选择「真实 AI 托管」，先用 **1 集、30 秒、100 元预算**。
3. 输入一句故事要求，确认制作计划；AI 会依次生成剧本、角色/场景/道具、结构化分镜、关键帧和动态镜头。
4. 在剧本、视觉资产、最终成片三个节点点击审核；驳回时填写修改意见，再点击「按意见重新生成」。
5. 最终审核通过后自动合成；也可以随时进入原制作页接管单个镜头。

工作台支持：

- 用一句自然语言生成结构化制作计划、分集节奏、镜头规模与费用估算；
- 确认计划后创建本地项目、分集剧本、角色锚点、场景和结构化分镜；
- 剧本、角色定妆/关键帧、最终成片三个强制审核点；
- 运行暂停、恢复、取消，审核驳回意见与同阶段重试；
- 真实图片/视频调用、逐镜用量估算、预算护栏和基础质检报告；
- 图片供应商自动回退、账号/模型级故障熔断、失败阶段重试与服务重启恢复；
- 从工作台进入原制作页继续编辑和人工接管。

「零费用演练」始终使用 `mock-local`，不会调用付费 API；「真实 AI 托管」会调用你配置的服务商，页面金额为估算，最终费用以供应商账单为准。配置存在不代表供应商账号已经开通对应模型，请先在 AI 配置页执行连接测试。建议使用 Node.js 20 或 22 LTS；过新的 Node.js 版本可能缺少 `better-sqlite3` 预编译包。

---

## 🤖 AI 服务商支持

| 服务商 | 文本 | 图片 | 视频 |
|--------|:----:|:----:|:----:|
| 阿里云 DashScope（通义） | ✅ | ✅ | ✅ |
| 火山引擎 Volcengine（豆包 / Seedance 2.0） | ✅ | ✅ | ✅ |
| 可灵 Kling AI（含 Omni） | — | ✅ | ✅ |
| Agnes AI | ✅ | ✅ | ✅ |
| Google Gemini（Imagen / Veo） | — | ✅ | ✅ |
| Vidu 生数科技 | — | — | ✅ |
| NanoBanana（含代理） | — | ✅ | — |
| 本地 Ollama 等 OpenAI 兼容 | ✅ | — | — |
| 其他 OpenAI 兼容接口 | ✅ | ✅ | — |

---

## 🏗 项目架构

```
LocalMiniDrama/
├── backend-node/     # Express + SQLite，生成/合成/导入导出
├── frontweb/         # Vue 3 + Element Plus + @vue-flow/core
│   └── views/        # FilmList · DramaDetail · FilmCreate · DramaCanvas
├── desktop/          # Electron 打包 exe
└── docs/             # 文档与计划
```

| 层 | 技术 |
|----|------|
| 前端 | Vue 3 · Vite · Element Plus · Pinia · @vue-flow/core |
| 后端 | Node.js · Express · SQLite (better-sqlite3) |
| 桌面 | Electron 28 · electron-builder |

---

## 🗺 后续计划 Roadmap

| 状态 | 计划 | 说明 |
|:----:|------|------|
| ✅ | Seedance 2.0 + 全能模式 | 多图 `@图片N` · `universal_segment_text` |
| ✅ | 画布工作流 | 列表/画布双视图 · 整组重跑 · 节点面板 |
| 📋 | **场景图 → 全景图** | 由场景参考图 AI 扩展超宽/360° 全景，供大景别运镜与场景库 |
| 📋 | 分镜参考图自由上传 | 任意图片作为分镜参考 |
| 📋 | 参考图自由选择 | 生图时手动指定角色/场景参考 |
| 📋 | 宫格图生成视频 | 多帧合图作为视频输入（部分模型已支持） |

> 认领功能或提建议 → [New Issue](https://github.com/xuanyustudio/LocalMiniDrama/issues/new)

<details>
<summary><b>📋 更多历史版本亮点（v1.2.3 及更早）</b></summary>

- **v1.2.3** 分镜解说旁白 · 导出解说 SRT
- **v1.2.2** 连贯帧模式 · 小说/长文导入 · ffmpeg 自动解压
- **v1.2.1** 可灵 Kling · 视频历史版本 · 场景/道具「加入本集」
- **v1.1.x** 多集剧本 · AI 并发 · 四宫格 · 批量生图/视频 …

详见 **[CHANGELOG.md](CHANGELOG.md)**

</details>

---

## 🎯 适合谁

| 用户 | 场景 |
|------|------|
| 📹 内容创作者 | 批量生产 AI 短剧 / 漫剧 |
| 🔒 隐私敏感 | 素材与剧本完全留在本机 |
| 🛠 开发者 | 二次开发、接入新 AI 服务商 |
| 🌱 入门探索 | 低成本体验 AI 视频全流程 |

---

## 🤝 参与贡献

- 🐛 [报告 Bug](https://github.com/xuanyustudio/LocalMiniDrama/issues/new)
- 💡 [功能建议](https://github.com/xuanyustudio/LocalMiniDrama/issues/new)
- 🔧 Fork → PR
- ⭐ **Star** 帮助更多人发现本项目

**GitHub 仓库建议 Topics**（在仓库 Settings → Topics 添加，便于搜索）：  
`ai-video` `short-drama` `storyboard` `vue3` `electron` `local-first` `seedance` `comic-drama`

---

<details>
<summary><b>☕ 一杯咖啡的鼓励</b></summary>

项目完全开源、无订阅。若对你有帮助，欢迎随缘打赏（自愿，不影响 Issue/PR 处理）：

<table>
  <tr>
    <td align="center"><img src="项目截图/weixinpay.jpg" alt="微信赞赏码" width="200"/><br/><sub>微信支付</sub></td>
    <td align="center"><img src="项目截图/ali.jpg" alt="支付宝收款码" width="200"/><br/><sub>支付宝</sub></td>
  </tr>
</table>

</details>

---

## 💬 联系 & 社区

[作者故事 & 碎碎念](docs/story.md) · 微信交流 / 用户群（二维码见仓库 `项目截图/` 目录）

> 群二维码约 7 天有效，过期请加作者微信拉群。

---

## 📄 License

[MIT](LICENSE)

---

<div align="center">

**如果这个项目对你有帮助，请点 ⭐ Star —— 这是对作者最大的鼓励！**

[⬇️ 立即下载](https://github.com/xuanyustudio/LocalMiniDrama/releases) · [📖 快速开始文档](docs/quickstart.md) · [🗺 画布文档](docs/plans/2026-06-15-drama-canvas-workflow-plan.md)

</div>
