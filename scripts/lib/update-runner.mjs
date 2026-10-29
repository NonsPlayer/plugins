import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { parseGitHubRepository } from './github.mjs'
import { readJson, removeDir, writeJson, writeText } from './json.mjs'
import { renderCatalogueReadme, renderPluginPage } from './markdown.mjs'
import { buildAuthors, buildEntry, buildIndex, buildPluginRecord } from './meta.mjs'
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

export async function runUpdate({
  root,
  registrations,
  github,
  maxReleases = 20,
  now = () => new Date().toISOString(),
  logger = console,
}) {
  const metaDir = path.join(root, 'meta')
  const catalogueDir = path.join(root, 'catalogue')
  const { previousIds, previousEntries } = await collectPrevious(metaDir)
  const entries = []
  const reports = []

  for (const registration of registrations) {
    const checkedAt = now()
    try {
      const { owner, repo } = parseGitHubRepository(registration.repository)
      const resolved = await resolveLatestRelease({
        github,
        owner,
        repo,
        pluginId: registration.id,
        maxReleases,
      })
      const entry = buildEntry(registration, resolved)
      entries.push(entry)
      const report = {
        id: registration.id,
        ok: true,
        checked_at: checkedAt,
        latest_version: resolved.version,
      }
      reports.push(report)

      await writeJson(path.join(metaDir, registration.id, 'plugin.json'), entry.plugin)
      await writeJson(path.join(metaDir, registration.id, 'release.json'), entry.release)
      await writeJson(path.join(metaDir, registration.id, 'meta.json'), entry.meta)
      await writeJson(path.join(metaDir, registration.id, 'all.json'), entry.all)
      await writeJson(path.join(metaDir, registration.id, 'update_report.json'), report)
      logger.log(`[ok] ${registration.id}: ${resolved.version}`)
    } catch (error) {
      const report = {
        id: registration.id,
        ok: false,
        checked_at: checkedAt,
        error: error.message,
      }
      reports.push(report)
      await writeJson(path.join(metaDir, registration.id, 'update_report.json'), report)

      const previous = previousEntries.get(registration.id)
      if (previous) {
        const plugin = buildPluginRecord(registration)
        const merged = {
          plugin,
          release: previous.release,
          meta: previous.meta,
        }
        entries.push({ ...merged, all: merged })
        logger.warn(`[warn] ${registration.id}: ${error.message}; keeping previous metadata`)
      } else {
        logger.error(`[error] ${registration.id}: ${error.message}`)
      }
    }
  }

  const currentIds = new Set(registrations.map((registration) => registration.id))
  for (const id of previousIds) {
    if (!currentIds.has(id)) {
      await removeDir(path.join(metaDir, id))
    }
  }

  entries.sort((a, b) => a.plugin.id.localeCompare(b.plugin.id))
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
      '- `<id>/`：单个插件的 `plugin.json`、`release.json`、`meta.json`、`all.json`、`update_report.json`。',
    ].join('\n'),
  )

  await removeDir(catalogueDir)
  await writeText(path.join(catalogueDir, 'README.md'), renderCatalogueReadme(entries, { generatedAt }))
  for (const entry of entries) {
    await writeText(path.join(catalogueDir, `${entry.plugin.id}.md`), renderPluginPage(entry))
  }

  return {
    entries,
    reports,
    failed: reports.filter((report) => !report.ok).length,
  }
}
