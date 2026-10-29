function escapeCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
}

function status(plugin) {
  if (plugin.blocked) return '已封禁'
  if (plugin.deprecated) return '已弃用'
  return plugin.official ? '官方' : '社区'
}

function authorText(plugin) {
  return plugin.authors
    .map((author) => (author.link ? `[${author.name}](${author.link})` : author.name))
    .join(', ')
}

function repositoryBlobUrl(plugin) {
  const base = plugin.repository.replace(/\.git$/, '').replace(/\/$/, '')
  const related = plugin.related_path && plugin.related_path !== '.' ? `/${plugin.related_path.replace(/^\.\//, '')}` : ''
  return `${base}/blob/${plugin.branch}${related}`
}

export function renderCatalogueReadme(entries, { generatedAt }) {
  const lines = [
    '# NonsPlayer 插件目录',
    '',
    `生成时间：${generatedAt}`,
    '',
    '本目录由定时任务从各插件仓库的最新 GitHub Release 自动生成。',
    '',
  ]

  if (entries.length === 0) {
    lines.push('暂无插件。', '')
    return lines.join('\n')
  }

  lines.push(
    '| 插件 | 版本 | 描述 | 作者 | 许可证 | 状态 |',
    '| --- | --- | --- | --- | --- | --- |',
  )
  for (const { plugin, meta } of [...entries].sort((a, b) => a.plugin.id.localeCompare(b.plugin.id))) {
    lines.push(
      `| [${escapeCell(meta.name)}](./${plugin.id}.md) | ${escapeCell(meta.version)} | ${escapeCell(meta.description ?? '')} | ${escapeCell(authorText(plugin))} | ${escapeCell(plugin.license)} | ${status(plugin)} |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}

export function renderPluginPage(entry) {
  const { plugin, meta, release } = entry
  const asset = release.releases[0].asset
  const lines = [
    `# ${meta.name}`,
    '',
    `- ID：\`${plugin.id}\``,
    `- 版本：\`${meta.version}\``,
    `- 作者：${authorText(plugin)}`,
    `- 许可证：${plugin.license}`,
    `- 仓库：${plugin.repository}`,
    `- 状态：${status(plugin)}`,
  ]

  if (plugin.labels.length > 0) {
    lines.push(`- 标签：${plugin.labels.map((label) => `\`${label}\``).join(', ')}`)
  }
  lines.push('')

  if (meta.description) {
    lines.push(meta.description, '')
  }
  if (plugin.preview) {
    lines.push(`![预览](${plugin.preview})`, '')
  }

  lines.push('## 权限', '')
  lines.push(meta.permissions.length > 0 ? meta.permissions.map((permission) => `- \`${permission}\``).join('\n') : '无', '')

  lines.push('## 兼容性', '')
  lines.push(
    `- 应用：\`${meta.engines.app}\``,
    `- 插件 API：\`${meta.engines.pluginApi}\``,
    `- UI API：\`${meta.engines.uiApi}\``,
    '',
  )

  const introductions = Object.entries(plugin.introduction ?? {})
  if (introductions.length > 0) {
    lines.push('## 介绍', '')
    const base = repositoryBlobUrl(plugin)
    for (const [language, file] of introductions) {
      lines.push(`- [${language}](${base}/${file})`)
    }
    lines.push('')
  }

  lines.push('## 下载', '')
  lines.push(`- [${asset.name}](${asset.browser_download_url})`)
  lines.push(`- 大小：${asset.size ?? '未知'} 字节`)
  lines.push(`- SHA-256：\`${asset.hash_sha256}\``)
  lines.push('')
  return lines.join('\n')
}
