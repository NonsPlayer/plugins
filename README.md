# NonsPlayer 插件目录

NonsPlayer 的第三方插件目录。仓库只保存注册信息和自动生成的元数据，不托管插件构建产物。

## 工作方式

- 作者在自己的仓库发布 GitHub Release，资产是插件 ZIP，根目录包含 `manifest.json`。
- 作者提一次 PR，添加 `plugins/<id>/plugin_info.json`。合并后发版不需要再提交 PR。
- 定时任务每 30 分钟拉取最新 Release，读取 manifest，校验 id、版本与 tag 一致，计算 MD5/SHA-256。
- 生成物发布到 `meta` 和 `catalogue` 分支：
  - `meta/index.json`：聚合索引，宿主和工具优先读取。
  - `meta/<id>/`：单个插件的 `plugin.json`、`release.json`、`meta.json`、`all.json`、`update_report.json`。
  - `catalogue/`：可浏览的 Markdown 目录。

## 目录结构

```text
plugins/<id>/plugin_info.json      # 第三方插件注册
plugins/<id>/introduction*.md      # 可选介绍
official/<id>/                     # 官方插件源码
schemas/plugin_info.schema.json
scripts/                           # 校验、抓取、生成
.github/workflows/                 # CI 与定时更新
```

## 对插件作者

1. 在插件仓库发布 GitHub Release，资产是插件 ZIP，根目录包含 `manifest.json`。
2. 在本仓库新增 `plugins/<id>/plugin_info.json`，提 PR。字段和发布要求见 [CONTRIBUTING.md](CONTRIBUTING.md)。
3. 合并后，发版不需要再动本仓库；定时任务会自动发现新版本。

插件模板与构建 CLI 随 Nons 侧发布的 `@nonsplayer/plugin-sdk` 提供。

## 维护者

- 审核注册 PR：源码、许可证、权限、Release 资产。
- 在 Actions 中手动触发 `Update catalogue` 可立即刷新。
- 下架或标记弃用：在 `plugin_info.json` 中设置 `deprecated` 或 `blocked`，不要删除条目。
- `unavailable` 由更新脚本在抓取失败时自动写入 `update_report.json`。

## 本地开发

```bash
pnpm install
pnpm test
pnpm catalogue:check --offline
```

`catalogue:check` 不带 `--offline` 时会访问 GitHub，需要 `GITHUB_TOKEN`。`catalogue:update` 需要 `GITHUB_TOKEN`，并在本地生成 `meta/` 和 `catalogue/`（两者已被 `.gitignore` 忽略）。

## 数据地址

```text
https://raw.githubusercontent.com/Miaoyww/plugins/meta/index.json
https://raw.githubusercontent.com/Miaoyww/plugins/meta/<id>/all.json
```

## 许可证

本仓库使用 GPL-3.0-only。第三方插件保留自己的许可证，但必须在白名单内。
