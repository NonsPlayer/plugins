# 贡献指南

本仓库收录 NonsPlayer 的功能插件与音乐适配器。源码和构建产物留在作者自己的仓库；本仓库保存注册信息，并自动生成索引。

## 提交前确认

- 插件或适配器已经打包成 ZIP，不是散落的源码目录。
- 插件或适配器适合公开使用，不是纯自用或明显重复的条目。
- 你是条目的作者、维护者或协作者，或有书面授权。
- 使用白名单内的开源许可证。

## 注册步骤

1. 在仓库发布一个 GitHub Release。资产是 ZIP，根目录必须包含 `manifest.json`。
2. 在本仓库新增注册文件：
   - 插件：`plugins/<id>/plugin_info.json`
   - 适配器：`adapters/<id>/adapter_info.json`
3. 提 PR。一个 PR 只加一个插件或适配器。

示例：

```json
{
  "id": "example-plugin",
  "repository": "https://github.com/owner/example-plugin",
  "branch": "main",
  "authors": [
    {
      "name": "Owner",
      "link": "https://github.com/owner"
    }
  ],
  "license": "GPL-3.0-only",
  "labels": ["tool"],
  "preview": "https://raw.githubusercontent.com/owner/example-plugin/main/preview.png",
  "introduction": {
    "zh-CN": "introduction-zh_cn.md"
  }
}
```

## 注册字段

插件使用 `plugin_info.json`，适配器使用 `adapter_info.json`，两者字段相同：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 条目 ID，必须与目录名和 manifest 的 ID 一致；`^[a-z][a-z0-9-]{0,63}$` |
| `repository` | 是 | 公开的 GitHub 仓库地址 |
| `branch` | 是 | 用于展示源码链接的分支 |
| `authors` | 是 | 至少一位作者；每项为 `{ "name": "...", "link": "https://..." }` |
| `license` | 是 | SPDX 许可证标识，必须在白名单内 |
| `related_path` | 否 | 条目在仓库中的子目录；monorepo 使用，根目录填 `.` 或省略 |
| `labels` | 否 | 最多 8 个标签，小写字母、数字和连字符 |
| `preview` | 否 | 预览图 URL，必须使用 HTTPS |
| `introduction` | 否 | 语言标签到 Markdown 文件路径的映射，文件放在注册目录内 |
| `deprecated` | 否 | 维护者标记弃用 |
| `blocked` | 否 | 维护者标记封禁 |

版本、名称、描述、权限、兼容范围和哈希由脚本从 Release 资产里的 `manifest.json` 自动提取，不要写进注册文件。

## Release 要求

- 仓库必须公开。
- Release 不能是 draft 或 prerelease。
- tag 必须是以下形式之一，且版本号与 manifest 的 `version` 完全一致：
  - `v1.2.3`
  - `1.2.3`
  - `<id>-1.2.3`
- 资产必须是 `.zip`，根目录包含 `manifest.json`；不要把内容放在 ZIP 内的子目录。
- 单个资产不超过 64 MiB；安装时最多 1024 个文件。
- 同一个 Release 有多个 ZIP 时，优先选择文件名以 `<id>-` 开头或等于 `<id>.zip` 的资产。

## 插件 Manifest 要求

- `id` 与注册 ID 一致。
- `version` 是合法 SemVer。
- `permissions` 是字符串数组。
- `engines` 包含 `app`、`pluginApi`、`uiApi`，值为合法 SemVer 范围。
- 至少声明 `backend` 或 `frontend`：
  - `backend` 必须以 `.wasm` 结尾，不超过 16 MiB。
  - `frontend` 必须以 `.mjs` 结尾，不超过 8 MiB。
- 权限和资源限制以宿主实际校验为准；目录侧只做结构校验。

## 适配器 Manifest 要求

- `version` 是合法 SemVer，且与 tag 一致。
- 只声明 `descriptor`（完整平台适配器）或 `resourceProvider`（独立音源）之一。
- `descriptor.source` 或 `resourceProvider.id` 与注册 ID 一致。
- `displayName` 非空；`contractVersion` 为正整数；`permissions` 为对象。
- 资产内包含适配器 WASM Component（`adapter.component.wasm`）。
- 适配器当前仍需由宿主随包或后续安装能力加载；目录只发布元数据与产物链接。

## 许可证白名单

```text
0BSD
AGPL-3.0-only
AGPL-3.0-or-later
Apache-2.0
BSD-2-Clause
BSD-3-Clause
GPL-3.0-only
GPL-3.0-or-later
ISC
LGPL-3.0-only
LGPL-3.0-or-later
MIT
MPL-2.0
Zlib
```

本仓库使用 GPL-3.0-only。第三方条目保留自己的许可证，但必须在上述白名单内。

## 审核

注册 PR 是唯一的人工审核点。维护者会检查：

- 提交者是否有权提交；
- 源码是否与描述一致，是否存在恶意行为；
- 许可证是否合规；
- Release 资产是否能下载，manifest 是否合规；
- 名称、描述和标签是否准确。

CI 会校验 schema、`id` 与目录名、仓库和分支、许可证、`related_path`，以及至少一个有效 Release。任何一项失败都需要修改后重新提交。

## 发版与更新

合并后不需要为每个版本提交 PR。定时任务会：

1. 拉取最新 Release；
2. 下载 ZIP 并读取 `manifest.json`；
3. 校验 id、版本和 tag；
4. 计算 MD5/SHA-256；
5. 更新 `meta` 和 `catalogue` 分支；随后将 `meta` 内容同步到 Cloudflare R2，并删除桶内已经不在最新 `meta/` 中的对象。

如果新版本校验失败，脚本保留上一次成功的数据，并在 `update_report.json` 中记录错误。

## 修改元数据、弃用与下架

- 修改作者、许可证、标签、介绍等：提 PR 修改注册文件。
- 弃用：维护者设置 `"deprecated": true`。
- 封禁：维护者设置 `"blocked": true`。
- 不要删除条目来下架；保留墓碑信息，避免已安装用户失去来源。

## 本地检查

```bash
pnpm install
pnpm test
pnpm catalogue:check --offline
```

不带 `--offline` 时会访问 GitHub，需要 `GITHUB_TOKEN`。
