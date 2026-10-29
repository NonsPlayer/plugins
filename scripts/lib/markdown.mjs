function escapeCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
}

function status(record) {
  if (record.blocked) return '已封禁'
  if (record.deprecated) return '已弃用'
  return '可用'
}

function authorText(record) {
  return record.authors
    .map((author) => (author.link ? `[${author.name}](${author.link})` : author.name))
    .join(', ')
}

function repositoryBlobUrl(record) {
  const base = record.repository.replace(/\.git$/, '').replace(/\/$/, '')
  const related = record.related_path && record.related_path !== '.' ? `/${record.related_path.replace(/^\.\//, '')}` : ''
  return `${base}/blob/${record.branch}${related}`
}

function byId(entries, kind) {
  return entries
    .filter((entry) => entry.kind === kind)
    .sort((a, b) => a.record.id.localeCompare(b.record.id))
}

export function renderCatalogueReadme(entries, { generatedAt }) {
  const lines = [
    '# NonsPlayer 插件目录',
    '',
    `生成时间：${generatedAt}`,
    '',
    '本目录由定时任务从各仓库的最新 GitHub Release 自动生成。',
    '',
  ]
  const plugins = byId(entries, 'plugin')
  const adapters = byId(entries, 'adapter')

  if (plugins.length === 0 && adapters.length === 0) {
    lines.push('暂无插件或适配器。', '')
    return lines.join('\n')
  }

  if (plugins.length > 0) {
    lines.push('## 插件', '')
    lines.push('| 插件 | 版本 | 描述 | 作者 | 许可证 | 状态 |', '| --- | --- | --- | --- | --- | --- |')
    for (const { record, meta } of plugins) {
      lines.push(
        `| [${escapeCell(meta.name)}](./${record.id}.md) | ${escapeCell(meta.version)} | ${escapeCell(meta.description ?? '')} | ${escapeCell(authorText(record))} | ${escapeCell(record.license)} | ${status(record)} |`,
      )
    }
    lines.push('')
  }

  if (adapters.length > 0) {
    lines.push('## 适配器', '')
    lines.push('| 适配器 | 版本 | 描述 | 作者 | 许可证 | 状态 |', '| --- | --- | --- | --- | --- | --- |')
    for (const { record, meta } of adapters) {
      lines.push(
        `| [${escapeCell(meta.name)}](./adapters/${record.id}.md) | ${escapeCell(meta.version)} | ${escapeCell(meta.description ?? '')} | ${escapeCell(authorText(record))} | ${escapeCell(record.license)} | ${status(record)} |`,
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

function renderCommonHeader(record, meta) {
  const lines = [
    `# ${meta.name}`,
    '',
    `- ID：\`${record.id}\``,
    `- 版本：\`${meta.version}\``,
    `- 作者：${authorText(record)}`,
    `- 许可证：${record.license}`,
    `- 仓库：${record.repository}`,
    `- 状态：${status(record)}`,
  ]
  if (record.labels.length > 0) {
    lines.push(`- 标签：${record.labels.map((label) => `\`${label}\``).join(', ')}`)
  }
  lines.push('')
  if (meta.description) {
    lines.push(meta.description, '')
  }
  if (record.preview) {
    lines.push(`![预览](${record.preview})`, '')
  }
  return lines
}

function renderIntroductions(record, lines) {
  const introductions = Object.entries(record.introduction ?? {})
  if (introductions.length === 0) return
  lines.push('## 介绍', '')
  const base = repositoryBlobUrl(record)
  for (const [language, file] of introductions) {
    lines.push(`- [${language}](${base}/${file})`)
  }
  lines.push('')
}

function renderDownload(release, lines) {
  const asset = release.releases[0].asset
  lines.push('## 下载', '')
  lines.push(`- [${asset.name}](${asset.browser_download_url})`)
  lines.push(`- 大小：${asset.size ?? '未知'} 字节`)
  lines.push(`- SHA-256：\`${asset.hash_sha256}\``)
  lines.push('')
}

export function renderPluginPage(entry) {
  const { record, meta, release } = entry
  const lines = renderCommonHeader(record, meta)

  lines.push('## 权限', '')
  lines.push(
    meta.permissions.length > 0 ? meta.permissions.map((permission) => `- \`${permission}\``).join('\n') : '无',
    '',
  )

  lines.push('## 兼容性', '')
  lines.push(
    `- 应用：\`${meta.engines.app}\``,
    `- 插件 API：\`${meta.engines.pluginApi}\``,
    `- UI API：\`${meta.engines.uiApi}\``,
    '',
  )

  renderIntroductions(record, lines)
  renderDownload(release, lines)
  return lines.join('\n')
}

export function renderAdapterPage(entry) {
  const { record, meta, release } = entry
  const lines = renderCommonHeader(record, meta)

  lines.push('## 支持平台', '')
  lines.push(meta.platforms.length > 0 ? meta.platforms.map((platform) => `- \`${platform}\``).join('\n') : '无', '')

  if (meta.searchPlatforms.length > 0) {
    lines.push('## 搜索平台', '')
    lines.push(meta.searchPlatforms.map((platform) => `- \`${platform}\``).join('\n'), '')
  }

  lines.push('## 权限', '')
  const permissions = meta.permissions
  const permissionLines = []
  for (const host of permissions.httpHosts) permissionLines.push(`- HTTP：\`${host}\``)
  for (const host of permissions.websocketHosts) permissionLines.push(`- WebSocket：\`${host}\``)
  if (permissions.system) permissionLines.push('- 系统时间与随机数')
  if (permissions.state) permissionLines.push('- 状态存储')
  if (permissions.credentials) permissionLines.push('- 账号凭据')
  lines.push(permissionLines.length > 0 ? permissionLines.join('\n') : '无', '')

  lines.push('## 兼容性', '')
  lines.push(`- 契约版本：\`${meta.contractVersion}\``, '')

  renderIntroductions(record, lines)
  renderDownload(release, lines)
  return lines.join('\n')
}
