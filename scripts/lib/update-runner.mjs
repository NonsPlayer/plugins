import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { parseGitHubRepository } from './github.mjs'
import { readJson, removeDir, writeJson, writeText } from './json.mjs'
import { renderAdapterPage, renderCatalogueReadme, renderPluginPage } from './markdown.mjs'
import { buildAuthors, buildEntry, buildIndex } from './meta.mjs'
import { resolveLatestRelease } from './release.mjs'

async function collectPrevious(metaDir) {
  const previousIds = new Set()
  const previousEntries = new Map()
  try {
    const entries = await readdir(metaDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '.git') continue
      previousIds.add(entry.name)
      try {
        previousEntries.set(entry.name, await readJson(path.join(metaDir, entry.name, 'all.json')))
      } catch {
        // The previous run did not finish; the current run must produce a complete entry.
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return { previousIds, previousEntries }
}

function recordFile(kind) {
  return kind === 'adapter' ? 'adapter.json' : 'plugin.json'
}

function previousRecord(kind, previous) {
  if (previous.record) return previous.record
  return kind === 'adapter' ? previous.adapter : previous.plugin
}

async function updateKind({
  kind,
  registrations,
  metaDir,
  previous,
  github,
  maxReleases,
  now,
  logger,
  entries,
  reports,
}) {
  for (const registration of registrations) {
    const checkedAt = now()
    try {
      const { owner, repo } = parseGitHubRepository(registration.repository)
      const resolved = await resolveLatestRelease({
        github,
        owner,
        repo,
        pluginId: registration.id,
        kind,
        distribution: registration.distribution,
        maxReleases,
      })
      const entry = buildEntry(kind, registration, resolved)
      entries.push(entry)
      const report = {
        id: registration.id,
        kind,
        ok: true,
        checked_at: checkedAt,
        latest_version: resolved.version,
      }
      reports.push(report)

      await writeJson(path.join(metaDir, registration.id, recordFile(kind)), entry.record)
      await writeJson(path.join(metaDir, registration.id, 'release.json'), entry.release)
      await writeJson(path.join(metaDir, registration.id, 'meta.json'), entry.meta)
      await writeJson(path.join(metaDir, registration.id, 'all.json'), entry.all)
      await writeJson(path.join(metaDir, registration.id, 'update_report.json'), report)
      logger.log(`[ok] ${registration.id}: ${resolved.version}`)
    } catch (error) {
      const report = {
        id: registration.id,
        kind,
        ok: false,
        checked_at: checkedAt,
        error: error.message,
      }
      reports.push(report)
      await writeJson(path.join(metaDir, registration.id, 'update_report.json'), report)

      const cached = previous.previousEntries.get(registration.id)
      if (cached) {
        const record = previousRecord(kind, cached)
        const merged = {
          kind,
          record,
          release: cached.release,
          meta: cached.meta,
        }
        entries.push({ ...merged, all: merged })
        logger.warn(`[warn] ${registration.id}: ${error.message}; keeping previous metadata`)
      } else {
        logger.error(`[error] ${registration.id}: ${error.message}`)
      }
    }
  }
}

export async function runUpdate({
  root,
  registrations,
  github,
  maxReleases = 20,
  now = () => new Date().toISOString(),
  logger = console,
}) {
  const metaDir = path.join(root, 'meta')
  const pluginMetaDir = path.join(metaDir, 'plugins')
  const adapterMetaDir = path.join(metaDir, 'adapters')
  const catalogueDir = path.join(root, 'catalogue')
  const pluginPrevious = await collectPrevious(pluginMetaDir)
  const adapterPrevious = await collectPrevious(adapterMetaDir)
  const entries = []
  const reports = []

  await updateKind({
    kind: 'plugin',
    registrations: registrations.plugins,
    metaDir: pluginMetaDir,
    previous: pluginPrevious,
    github,
    maxReleases,
    now,
    logger,
    entries,
    reports,
  })
  await updateKind({
    kind: 'adapter',
    registrations: registrations.adapters,
    metaDir: adapterMetaDir,
    previous: adapterPrevious,
    github,
    maxReleases,
    now,
    logger,
    entries,
    reports,
  })

  const pluginIds = new Set(registrations.plugins.map((registration) => registration.id))
  for (const id of pluginPrevious.previousIds) {
    if (!pluginIds.has(id)) {
      await removeDir(path.join(pluginMetaDir, id))
    }
  }
  if (registrations.plugins.length === 0) {
    await removeDir(pluginMetaDir)
  }
  const adapterIds = new Set(registrations.adapters.map((registration) => registration.id))
  for (const id of adapterPrevious.previousIds) {
    if (!adapterIds.has(id)) {
      await removeDir(path.join(adapterMetaDir, id))
    }
  }
  if (registrations.adapters.length === 0) {
    await removeDir(adapterMetaDir)
  }

  const keptDirectories = new Set(['.git', 'plugins', 'adapters'])
  for (const entry of await readdir(metaDir, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })) {
    if (entry.isDirectory() && !keptDirectories.has(entry.name)) {
      await removeDir(path.join(metaDir, entry.name))
    }
  }

  entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.record.id.localeCompare(b.record.id))
  const generatedAt = now()

  await writeJson(path.join(metaDir, 'index.json'), buildIndex(entries, { generatedAt }))
  await writeJson(path.join(metaDir, 'authors.json'), buildAuthors(entries))
  await writeText(
    path.join(metaDir, 'README.md'),
    [
      '# NonsPlayer 插件元数据',
      '',
      `生成时间：${generatedAt}`,
      '',
      '- `index.json`：聚合索引，宿主和工具优先读取此文件。',
      '- `authors.json`：作者聚合。',
      '- `plugins/<id>/`：插件的 `plugin.json`、`release.json`、`meta.json`、`all.json`、`update_report.json`。',
      '- `adapters/<id>/`：适配器的 `adapter.json`、`release.json`、`meta.json`、`all.json`、`update_report.json`。',
    ].join('\n'),
  )

  await removeDir(catalogueDir)
  await writeText(path.join(catalogueDir, 'README.md'), renderCatalogueReadme(entries, { generatedAt }))
  for (const entry of entries) {
    const page =
      entry.kind === 'adapter' ? `adapters/${entry.record.id}.md` : `${entry.record.id}.md`
    const render = entry.kind === 'adapter' ? renderAdapterPage : renderPluginPage
    await writeText(path.join(catalogueDir, page), render(entry))
  }

  return {
    entries,
    reports,
    failed: reports.filter((report) => !report.ok).length,
  }
}
