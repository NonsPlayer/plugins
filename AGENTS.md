# 开发约定

## 代码库调查

实现功能前先调查现状：阅读适用的项目文档和 ADR，检索现有实现、调用方、测试及近期相关改动，确认已有契约、可复用方案和实际缺口。仓库已建立 CodeGraph 索引时，先用 CodeGraph 定位代码与调用关系，再按需查看其他资料。开始修改前，先整理带文件或符号位置的调查结论，并说明拟复用的实现及仍需新增的部分；以已确认的证据为边界，未确认的行为按验收规则向用户澄清。

需要调查代码库时，启动子代理协助，明确调查范围并要求返回代码位置、证据与未决问题；主代理核对关键证据并汇总结论。按任务复杂度与范围选择当前可用的子代理模型和推理强度。

## 开发规则

- 每项实现考虑速度和内存成本。性能结论区分设计预期与实测结果，报告实测环境、场景和统计口径。
- 优先采用成熟库；确需自行实现已有库覆盖的能力时，先告知用户必要性。
- 每次可发布行为变更更新 CHANGELOG 的 Unreleased；只记录已实现的用户可见变化。

## 文件组织

- 所有新增、修改或迁移的代码先确定所属功能，放入对应目录。
- 按维护时需要一起理解和修改的功能组织文件。同一目标的页面、控件、状态、服务和专用辅助代码就近存放；功能增长后再在其目录内细分。
- 跨功能复用的代码放入职责明确的共享目录，通用 UI 与业务控件分开。入口文件负责组装；目录名称应能说明功能或职责。
- 选择目录时先查看现有结构与引用关系，优先归入已有功能。以便于维护为判断标准，避免仅按文件类型或严格分层把协同变化的实现拆散。
- 移动文件时同步更新导入、模块声明、测试、脚本和文档中的路径；完成相关构建与测试，并检查旧路径引用后才算整理完成。

## 验收

- 实现前，凡需要实现的部分仍模糊、存在未确定的范围或行为、需要进一步作出具体决定时，必须询问用户并得到明确答复后再进行相关实现；不得自行假定、补全需求或替用户决定。已明确的用户决定继续有效，无需重复询问；不依赖该答复的工作可以继续。
- 每次交付逐项对照用户目标，明确已实现、尚未达到及实际验证范围。发现任何改动未达到目标时及时通知用户，说明差距、原因、影响与后续处理；临时兼容、绕行或分阶段实现也必须说明，不能以测试通过或文档已写代替目标完成，不能隐去保留的平台耦合或夸大迁移结果。
- 每轮验收先执行项目约定的格式化命令，再运行本次改动所需的构建与测试；后续修改代码时重新执行此顺序。
- 格式化失败时先修复，再继续验收。格式化产生的改动一并检查并按提交约定处理；最终以项目约定的格式检查通过为格式验收标准，不代替功能和目标验收。

## 工作区文档

- 调研、比较、方案和设计稿等讨论材料写入 `.local/` 下的 Markdown 文档，供后续会话直接读取；`.local/` 已被 `.gitignore` 忽略，不进入版本库。
- 实现前先把步骤、依赖和验收标准写入 `.local/plans/`，执行过程中更新状态；计划不进入版本库。
- 对话中形成的调研结论同步落到文档，不把聊天记录作为唯一载体。

## 实现约定

- 目录脚本使用 Node.js ESM（`.mjs`）与 pnpm；依赖声明在 `package.json`。
- `meta/`、`catalogue/` 是生成分支的工作目录，已被 `.gitignore` 忽略，不提交到 `main`。
- 插件注册放在 `plugins/<id>/plugin_info.json`，适配器注册放在 `adapters/<id>/adapter_info.json`；源码和构建产物留在各作者仓库。
- 目录数据由定时任务从作者仓库的最新 Release 生成；不要在 `meta/` 或 `catalogue/` 手工修改。

## 提交约定

- 讨论阶段产出的调研、方案、设计稿、ADR 及相关规范补充保留在工作区供审阅；只有用户明确要求提交这些内容时才创建 commit。认可设计方向或要求写文档不等于授权提交。
- 实现阶段，每个已确定并完成必要验证的修改，按独立、完整的逻辑部分直接提交 commit，无需再次确认；仅暂存该部分涉及的改动。提交实现时不夹带工作区内尚未获准提交的讨论材料。
- 提交作者使用 `Miaoyww`；邮箱沿用仓库已有的 Git 身份配置。
- 提交信息遵守 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/zh-hans/v1.0.0/)，格式为 `<type>[可选 scope][可选 !]: <描述>`；类型保留 `feat`、`fix`、`docs` 等英文标识，描述和正文优先使用中文，例如 `docs: 补充自动分段提交约定`。破坏性变更使用 `!` 或 `BREAKING CHANGE:` 标记。

## 文档查询

涉及库、框架、SDK、API、CLI 或云服务的用法、配置、迁移和相关调试时，使用 Context7：先 resolve-library-id，再按单一概念 query-docs。用户给出准确库 ID 时可直接查询。索引缺失或信息不足时说明原因，使用官方文档或源码补充。

## 文档限制

所有文档和代码注释均描述当前状态，不得记录任何AI历史修改记录。更新当前状态描述不得将尚未确认的实现偏差写成新的业务规则。--比如某次开发工作临时规划了phase1到phase5阶段，那么任何文档不允许记录phase1-phase5相关字段描述，只需要按照代码和项目现状更新文档内容即可。
比如某次开发需求A决策是当前项目现状，B决策是这次开发任务新的决策，且A决策作废，那么文档记录就不能留下A决策的历史，只需要记录这次新的决策B。

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
