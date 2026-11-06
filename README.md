<div align="center">

<img src="docs/app-icon.png" alt="NonsPlayer Logo" height="128" width="128">

# NonsPlayer 插件目录

[![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-lightgrey?style=flat-square)](#)
![License](https://img.shields.io/github/license/Miaoyww/NonsPlayer)

**轻量 | 全平台 | 流媒体&本地**

</div>


# 目录

在[这里](https://github.com/NonsPlayer/plugins/tree/catalogue)查看所有插件.

# 插件的提交及更新

## 提交

1. Clone 本仓库到本地.
2. 添加注册文件：插件使用 `plugins/<id>/plugin_info.json`，适配器使用 `adapters/<id>/adapter_info.json`.
3. 提交 PR.字段与 Release 要求见 [CONTRIBUTING.md](CONTRIBUTING.md).

## 更新

1. 直接在自己的仓库发布新的 GitHub Release 即可.
2. 定时任务会把最新 Release 的 ZIP 镜像到 `https://nons-dist.miaoyww.top/`，索引中的安装包地址指向该 CDN；每次更新会替换桶内上一次的产物.

## 禁用以及删除

若您的插件或适配器不再更新, 您可以在 PR 中将 `deprecated` 字段设置为 `true`，或直接删除注册文件.

删除注册文件后，注册目录中的介绍文件可以保留。合并到 `main` 后，更新任务会把该条目从索引中移除，并从 R2 删除对应产物。


# manifest.json示例

## 插件

```json
{
  "id": "example-plugin",
  "name": "Example Plugin",
  "version": "1.0.0",
  "description": "An example plugin",
  "permissions": ["ui", "storage"],
  "engines": {
    "app": "^1.0.0",
    "pluginApi": "^2.1.0",
    "uiApi": "^2.1.0"
  },
  "frontend": "ui.mjs"
}
```

`backend` 可选，指向 `.wasm` 文件；`backend` 与 `frontend` 至少声明一个。

完整字段见 [plugin_manifest.schema.json](schemas/plugin_manifest.schema.json "plugin_manifest.schema.json").


## 适配器

可安装适配器必须声明 `descriptor` 或 `resourceProvider` 之一，并提供 `permissions`。包内需要 `adapter.component.wasm`，位于根目录或 `dist/`。

```json
{
  "version": "1.0.0",
  "descriptor": {
    "source": "example-platform",
    "displayName": "Example Adapter",
    "description": "示例适配器",
    "contractVersion": 1,
    "capabilities": ["search", "browse"],
    "platforms": ["example-platform"],
    "coverHosts": ["cdn.example.org"]
  },
  "permissions": {
    "httpHosts": ["api.example.org"],
    "websocketHosts": [],
    "system": false,
    "state": true,
    "credentials": true
  }
}
```

使用 `resourceProvider` 时，描述对象包含 `id`、`displayName`、`contractVersion`、`platforms`，可选 `description`、`searchPlatforms`、`coverHosts`；此类适配器不能申请 `state`、`credentials` 或非空 `websocketHosts`。

完整字段见 [adapter_manifest.schema.json](schemas/adapter_manifest.schema.json "adapter_manifest.schema.json").
