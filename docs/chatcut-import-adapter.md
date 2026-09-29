# ChatCut 批准素材导入适配器

状态（2026-09-21）：导入计划、映射校验和带SQLite断点的执行器已实现并通过注入传输测试。尚未提供生产MCP传输适配/前端自动执行入口、时间线创建与导出回传。旧样片的Desktop实机测试不能替代新执行器联调。

## 入口和边界

`GET /api/v1/agent/runs/:id/chatcut-import-plan` 是只读计划接口。只接受当前真实且已批准的视频链；Mock、审批缺失、文字/视频/音频版本变化均被拒绝。结果是平台适配计划，不是ChatCut原生工程，不表示已连接。

`chatcutAssetImporter.importAssets(db, cfg, runId, projectId, client)` 由可信宿主提供官方MCP传输。client.callTool(name, arguments) 返回MCP CallToolResult；不能直接接收模型编写的工具结果当作真实连接。执行器只允许读取工程/工具说明、push_asset和inspect_asset；不会调用任何模型生成。

## 防止旧旁白重新混入

- 精确使用批准快照里的local_path、SHA256、字节数、source_id和handoff digest；不按文件名、目录顺序或更新时间选素材。
- 每镜视频、对白与旁白分别映射，文本和文件属于同一交接版本。
- 导入前、每次提交前、提交后、全部完成后重读批准链；变化即阻断。
- 每个文件单独提交，回读真实asset ID与媒体类型。映射不依赖返回数组次序。
- AIFF已在历史实机测试中被拒绝；当前执行器在提交前阻断，待实现带来源指纹的无损WAV派生记录。不能找同目录的另一个WAV替代。

## 断点与重复调用

迁移28_chatcut_imports.sql以run、handoff digest、目标工程、source_id组成唯一键。

1. 发出导入前先写PENDING。
2. 返回素材ID、目标工程仍一致、批准链未变、inspect_asset可回读后才写IMPORTED。
3. 成功结果重复执行：核对批准源并回读已保存素材，复用ID，不再push。
4. 远程异常或回读不确定：保存UNKNOWN和已知素材ID。PENDING/UNKNOWN均禁止自动重试，避免“服务实际成功但响应丢失”造成重复素材。
5. 不提供一键清空断点重试。需先在Desktop核对未知操作，再实现可审计的对账恢复；该恢复入口尚待开发。

数据库唯一键同时阻止两个执行器对同一素材重复登记。不同交接版本不自动复用旧批准记录。

## 证据限制

源文件哈希在本地计算；Desktop当前回读只确认素材ID/类型和所在活动工程，不能证明Desktop内部副本的字节哈希。模型/客户端手工构造的receipt仅能校验映射，不会标记连接已验证。

导入成功不建立时间线、不标记EXPORTED、不认定内容PASS。实际连续动作、发音、对白语义及口型仍需要完整媒体审核。

## 验证

- chatcutImportPlan.test.js：修订旁白选择、文字篡改、同路径改写、旧回执、错工程、缺/重复/错误映射。
- agentVideoReview.test.js：真实批准链校验，执行器成功后重复调用不push、连接异常不重复提交、错工程0修改、导入中源变化保留UNKNOWN。
- scripts/smoke.cjs：隔离服务启动、Mock导入计划HTTP400。
- 全量命令：`PATH=/Users/shenzihao/.nvm/versions/node/v22.17.1/bin:$PATH npm run verify`。

下一步：实际宿主MCP传输与只读连接预检、未知操作对账恢复；随后创建可编辑时间线和导出回传。没有把手工样片伪装成当前平台批准任务。

## 最新状态（2026-09-21）
以上“生产传输/时间线/回传待开发”的早期记录已更新：正式注册传输、自动时间线、回传与工作台入口已通过实机隔离验证，见chatcut-pipeline-acceptance-20260921.md。UNKNOWN对账恢复与高级字幕/特效版本证据仍待扩展。
