# GPT Image 2、Pro 与本地代理

核实日期：2026-09-17。未修改代理源码、账号套餐或生产模型配置。

## 已证实

- GPT Image 2 有官方 API 型号 `gpt-image-2` / `gpt-image-2-2026-04-21`；官方图像接口为 `/v1/images/generations`、`/v1/images/edits`。参见 https://developers.openai.com/api/docs/models/gpt-image-2 和 https://developers.openai.com/api/docs/guides/image-generation 。
- Codex 内置图像生成可使用符合条件的 ChatGPT 套餐额度；以 API Key 调用时适用 API 计费。购买 Pro 不等于获得平台 API 免费额度，也不能保证第三方代理兼容。参见 https://learn.chatgpt.com/docs/pricing 的 image generation 与 API Key 部分。
- 本机 AIClient2API 3.0.0 的 `src/providers/openai/codex-core.js` 在 `prepareRequestBody` 中，把 `gpt-image-2` 硬编码改写为 `gpt-5.4`，再设置 `tools:[{type:'image_generation'}]`。没有在工具中固定具体图像模型。
- 零网络执行该方法得到 `requested=gpt-image-2, upstream=gpt-5.4`；已有 2026-09-17 日志同时出现：`The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account.`。因此报错里的 GPT-5.4 来自代理映射，不能解释成 GPT Image 2 本身不存在。

## 建议

正式平台先通过 OpenAI 官方 Image API 接入指定图像模型，单独配置 API Key 与额度；已有客户端保留自定义 OpenAI 兼容 base URL。尚未提供官方 API 凭据，因此本轮没有声称官方生图连通性已验证。

个人创作可以使用 Codex 自带图像工具，但其套餐能力不自动成为本平台可调用的公共 Image API。

不建议仅为修复此错误购买 Pro。若继续使用代理，需要独立验证当前账号支持的上游文本模型、image_generation 工具权限、图片模型选择与参考图协议；只换一个模型名未必能解决。不得把 `/models` 列表里的名称当作成功生图的证明。

## 本轮测试费用

- 一次现有 DeepSeek 默认文本模型调用，输出 token 上限 1800，导演计划返回 READY。
- 图片、视频、TTS 真实请求均为 0。
- 当前文本客户端不返回实际可核账金额；以供应商账单为准。媒体方案参考估算 ¥36.98 不属于此次测试实际支出。
