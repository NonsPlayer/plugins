# NonsPlayer 插件目录

NonsPlayer 的插件与音乐适配器目录。仓库保存注册信息和自动生成的元数据，源码、构建产物与 Release 放在各作者自己的仓库。

## 工作方式

- 作者在自己的仓库发布 GitHub Release：插件资产是 ZIP，根目录包含 `manifest.json`；适配器资产是 ZIP，根目录包含带 `version`、`descriptor` 或 `resourceProvider`、`permissions` 的 `manifest.json`。
- 作者提一次 PR，添加 `plugins/<id>/plugin_info.json` 或 `adapters/<id>/adapter_info.json`。合并后发版不需要再提交 PR。
- 定时任务每 30 分钟拉取最新 Release，读取 manifest，校验 id、版本与 tag 一致，计算 MD5/SHA-256。
- 生成物发布到 `meta` 和 `catalogue` 分支：
  - `meta/index.json`：聚合索引，`plugins` 与 `adapters` 两个数组，宿主和工具优先读取。
  - `meta/<id>/`：单个插件；`meta/adapters/<id>/`：单个适配器。各自包含 `plugin.json` 或 `adapter.json`、`release.json`、`meta.json`、`all.json`、`update_report.json`。
  - `catalogue/`：可浏览的 Markdown 目录，适配器页面位于 `catalogue/adapters/`。

## 目录结构

```text
plugins/<id>/plugin_info.json       # 插件注册
plugins/<id>/introduction*.md       # 可选介绍
adapters/<id>/adapter_info.json     # 适配器注册
adapters/<id>/introduction*.md      # 可选介绍
schemas/plugin_info.schema.json
schemas/adapter_info.schema.json
scripts/                            # 校验、抓取、生成
.github/workflows/                  # CI 与定时更新
```

## 对插件与适配器作者

1. 在自己的仓库发布 GitHub Release，资产是 ZIP，根目录包含 `manifest.json`。
2. 在本仓库新增 `plugins/<id>/plugin_info.json` 或 `adapters/<id>/adapter_info.json`，提 PR。字段和发布要求见 [CONTRIBUTING.md](CONTRIBUTING.md)。
3. 合并后，发版不需要再动本仓库；定时任务会自动发现新版本。

插件模板与构建 CLI 随 Nons 侧发布的 `@nonsplayer/plugin-sdk` 提供；适配器使用 `packages/music-adapter-sdk` 的契约构建 WASM Component。

## 维护者

- 审核注册 PR：源码、许可证、权限、Release 资产。
- 在 Actions 中手动触发 `Update catalogue` 可立即刷新。
- 下架或标记弃用：在注册文件中设置 `deprecated` 或 `blocked`，不要删除条目。
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
https://raw.githubusercontent.com/NonsPlayer/plugins/meta/index.json
https://raw.githubusercontent.com/NonsPlayer/plugins/meta/<id>/all.json
https://raw.githubusercontent.com/NonsPlayer/plugins/meta/adapters/<id>/all.json
```

`Update catalogue` 工作流还会在发布 `meta` 分支后，将同一份 `meta/` 内容同步到 Cloudflare R2 的 `nons-plugin` 桶。同步使用删除模式，桶内已经不在最新 `meta/` 中的对象会自动清理；`catalogue/` 不会上传。

维护者需要在仓库的 GitHub Actions secrets 中配置：

- `R2_ENDPOINT`：完整的 R2 S3 endpoint，例如 `https://<account-id>.r2.cloudflarestorage.com`。
- `R2_ACCESS_KEY_ID`：R2 S3 API 令牌的访问密钥 ID。
- `R2_SECRET_ACCESS_KEY`：R2 S3 API 令牌的机密访问密钥。

公开下载还需要在 Cloudflare 中为该桶配置自定义域名或公开访问地址。公开域名不写入工作流，避免在域名尚未确定时形成错误的客户端地址。

## 许可证

本仓库使用 GPL-3.0-only。第三方插件与适配器保留自己的许可证，但必须在白名单内。
