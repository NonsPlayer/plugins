# adapters/

音乐适配器注册目录。每个适配器一个子目录：

```text
adapters/<id>/adapter_info.json
adapters/<id>/introduction.md
adapters/<id>/introduction-zh_cn.md
```

只放注册信息和可选的介绍文件；适配器源码、WASM Component 与构建产物留在作者自己的仓库，通过 GitHub Release 发布。

字段说明与提交步骤见根目录 [CONTRIBUTING.md](../CONTRIBUTING.md)。适配器 Release 的 `manifest.json` 需包含 `version`，并声明 `descriptor` 或 `resourceProvider` 之一。
