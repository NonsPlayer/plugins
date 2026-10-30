import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { buildEntry } from '../scripts/lib/meta.mjs'
import { runUpdate } from '../scripts/lib/update-runner.mjs'

const registration = {
  id: 'demo-plugin',
  repository: 'https://github.com/owner/repo',
  branch: 'main',
  authors: [{ name: 'Owner' }],
  license: 'MIT',
  labels: ['tool'],
}

const manifest = {
  id: 'demo-plugin',
  name: 'Demo',
  version: '1.2.3',
  description: 'A demo plugin',
  permissions: ['ui'],
  engines: { app: '^1.0.0', pluginApi: '^2.1.0', uiApi: '^2.1.0' },
  frontend: 'ui.mjs',
}

const adapterRegistration = {
  id: 'demo-adapter',
  repository: 'https://github.com/owner/adapter',
  branch: 'main',
  authors: [{ name: 'Owner' }],
  license: 'MIT',
}

const adapterManifest = {
  version: '1.0.0',
  resourceProvider: {
    id: 'demo-adapter',
    displayName: 'Demo Adapter',
    description: 'A demo adapter',
    contractVersion: 1,
    platforms: ['netease'],
    searchPlatforms: [],
    coverHosts: [],
  },
  permissions: {
    httpHosts: ['example.org'],
    websocketHosts: [],
    system: false,
    state: false,
    credentials: false,
  },
}

function pluginRelease() {
  const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) })
  return {
    draft: false,
    prerelease: false,
    tag_name: 'v1.2.3',
    html_url: 'https://github.com/owner/repo/releases/tag/v1.2.3',
    name: '',
    body: '',
    created_at: '2026-01-01T00:00:00Z',
    assets: [
      {
        id: 1,
        name: 'demo-plugin-1.2.3.zip',
        size: bytes.length,
        browser_download_url: 'https://example.com/demo-plugin-1.2.3.zip',
        download_count: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  }
}

function adapterRelease() {
  const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify(adapterManifest)) })
  return {
    draft: false,
    prerelease: false,
    tag_name: 'v1.0.0',
    html_url: 'https://github.com/owner/adapter/releases/tag/v1.0.0',
    name: '',
    body: '',
    created_at: '2026-01-01T00:00:00Z',
    assets: [
      {
        id: 2,
        name: 'demo-adapter-1.0.0.zip',
        size: bytes.length,
        browser_download_url: 'https://example.com/demo-adapter-1.0.0.zip',
        download_count: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  }
}

function fakeGitHub({ fail = false, downloadCount = 7 } = {}) {
  return {
    async listReleases(owner, repo) {
      if (fail) throw new Error('network down')
      const release = repo === 'repo' ? pluginRelease() : repo === 'adapter' ? adapterRelease() : null
      if (!release) return []
      release.assets[0].download_count = downloadCount
      return [release, {
        ...release,
        tag_name: 'v0.1.0',
        assets: [{ ...release.assets[0], download_count: 11 }],
      }]
    },
    async download(url) {
      if (url.includes('demo-plugin')) {
        return new Uint8Array(
          zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) }),
        )
      }
      return new Uint8Array(zipSync({ 'manifest.json': strToU8(JSON.stringify(adapterManifest)) }))
    },
  }
}

function fakeResolved(version = '1.2.3') {
  const release = pluginRelease()
  return {
    version,
    totalDownloadCount: 18,
    release: { ...release, tag_name: `v${version}` },
    asset: release.assets[0],
    summary: {
      id: 'demo-plugin',
      name: 'Demo',
      version,
      description: 'A demo plugin',
      permissions: ['ui'],
      httpHosts: null,
      fileRoots: null,
      engines: { app: '^1.0.0', pluginApi: '^2.1.0', uiApi: '^2.1.0' },
      backend: null,
      frontend: 'ui.mjs',
    },
    sha256: 'a'.repeat(64),
    md5: 'b'.repeat(32),
    history: [],
  }
}

async function tempRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nons-catalogue-run-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('writes plugin and adapter metadata and catalogue output', async (t) => {
  const root = await tempRoot(t)
  await mkdir(path.join(root, 'catalogue'), { recursive: true })
  await writeFile(path.join(root, 'catalogue', 'demo-plugin.md'), 'old page')
  await writeFile(path.join(root, 'catalogue', 'removed-plugin.md'), 'removed page')
  const result = await runUpdate({
    root,
    registrations: { plugins: [registration], adapters: [adapterRegistration] },
    github: fakeGitHub(),
    now: () => '2026-01-01T00:00:00.000Z',
    logger: { log() {}, warn() {}, error() {} },
  })

  assert.equal(result.entries.length, 2)
  assert.equal(result.failed, 0)

  const index = JSON.parse(await readFile(path.join(root, 'meta', 'index.json'), 'utf8'))
  assert.equal(index.generated_at, '2026-01-01T00:00:00.000Z')
  assert.equal(index.plugins[0].id, 'demo-plugin')
  assert.equal(index.plugins[0].version, '1.2.3')
  assert.equal(index.plugins[0].total_download_count, 18)
  assert.equal(index.adapters[0].id, 'demo-adapter')
  assert.deepEqual(index.adapters[0].platforms, ['netease'])
  assert.equal(index.adapters[0].total_download_count, 18)

  assert.deepEqual((await readdir(path.join(root, 'meta'))).sort(), [
    'README.md', 'adapters', 'authors.json', 'index.json', 'plugins',
  ])
  for (const [kind, id, record] of [
    ['plugins', 'demo-plugin', 'plugin.json'],
    ['adapters', 'demo-adapter', 'adapter.json'],
  ]) {
    assert.deepEqual((await readdir(path.join(root, 'meta', kind, id))).sort(), [
      'all.json', 'meta.json', record, 'release.json', 'update_report.json',
    ].sort())
  }
  const metaReadme = await readFile(path.join(root, 'meta', 'README.md'), 'utf8')
  assert.match(metaReadme, /`plugins\/<id>\/`/)
  assert.match(metaReadme, /`adapters\/<id>\/`/)

  const all = JSON.parse(await readFile(path.join(root, 'meta', 'plugins', 'demo-plugin', 'all.json'), 'utf8'))
  assert.equal(all.release.latest_version, '1.2.3')
  const adapterAll = JSON.parse(
    await readFile(path.join(root, 'meta', 'adapters', 'demo-adapter', 'all.json'), 'utf8'),
  )
  assert.equal(adapterAll.release.latest_version, '1.0.0')
  assert.equal(adapterAll.record.id, 'demo-adapter')
  for (const [kind, id] of [['plugins', 'demo-plugin'], ['adapters', 'demo-adapter']]) {
    const entryDir = path.join(root, 'meta', kind, id)
    const meta = JSON.parse(await readFile(path.join(entryDir, 'meta.json'), 'utf8'))
    const all = JSON.parse(await readFile(path.join(entryDir, 'all.json'), 'utf8'))
    assert.equal(meta.total_download_count, 18)
    assert.equal(all.meta.total_download_count, 18)
    assert.equal(all.release.releases[0].meta.total_download_count, 18)
    assert.equal(all.release.releases[0].asset.download_count, 7)
  }

  const readme = await readFile(path.join(root, 'catalogue', 'README.md'), 'utf8')
  assert.match(readme, /Demo/)
  assert.match(readme, /Demo Adapter/)
  assert.deepEqual((await readdir(path.join(root, 'catalogue'))).sort(), [
    'README.md', 'adapters', 'plugins',
  ])
  assert.match(readme, /\[Demo\]\(\.\/plugins\/demo-plugin\.md\)/)
  const pluginPage = await readFile(path.join(root, 'catalogue', 'plugins', 'demo-plugin.md'), 'utf8')
  assert.match(pluginPage, /# Demo/)
  const page = await readFile(path.join(root, 'catalogue', 'adapters', 'demo-adapter.md'), 'utf8')
  assert.match(page, /契约版本/)
})

test('keeps previous metadata on failure and removes stale entries', async (t) => {
  const root = await tempRoot(t)
  const previous = buildEntry('plugin', registration, fakeResolved('1.0.0'))
  await mkdir(path.join(root, 'meta', 'plugins', 'demo-plugin'), { recursive: true })
  await writeFile(path.join(root, 'meta', 'plugins', 'demo-plugin', 'all.json'), JSON.stringify(previous.all))
  await mkdir(path.join(root, 'meta', 'plugins', 'old-plugin'), { recursive: true })
  await writeFile(path.join(root, 'meta', 'plugins', 'old-plugin', 'all.json'), JSON.stringify(previous.all))

  const result = await runUpdate({
    root,
    registrations: { plugins: [registration], adapters: [] },
    github: fakeGitHub({ fail: true }),
    now: () => '2026-01-02T00:00:00.000Z',
    logger: { log() {}, warn() {}, error() {} },
  })

  assert.equal(result.failed, 1)
  const index = JSON.parse(await readFile(path.join(root, 'meta', 'index.json'), 'utf8'))
  assert.equal(index.plugins[0].version, '1.0.0')
  assert.equal(index.plugins[0].total_download_count, 18)

  const report = JSON.parse(await readFile(path.join(root, 'meta', 'plugins', 'demo-plugin', 'update_report.json'), 'utf8'))
  assert.equal(report.ok, false)
  assert.match(report.error, /network down/)

  await assert.rejects(access(path.join(root, 'meta', 'plugins', 'old-plugin')), { code: 'ENOENT' })
})

test('preserves both kinds on failure and removes metadata when registrations are removed', async (t) => {
  const root = await tempRoot(t)
  const args = {
    root,
    registrations: { plugins: [registration], adapters: [adapterRegistration] },
    logger: { log() {}, warn() {}, error() {} },
  }
  await runUpdate({ ...args, github: fakeGitHub() })
  await runUpdate({ ...args, github: fakeGitHub({ downloadCount: 19 }) })
  const refreshed = JSON.parse(await readFile(path.join(root, 'meta', 'index.json'), 'utf8'))
  assert.equal(refreshed.plugins[0].total_download_count, 30)
  assert.equal(refreshed.adapters[0].total_download_count, 30)
  const result = await runUpdate({ ...args, github: fakeGitHub({ fail: true }) })
  assert.equal(result.failed, 2)
  const index = JSON.parse(await readFile(path.join(root, 'meta', 'index.json'), 'utf8'))
  assert.equal(index.plugins[0].version, '1.2.3')
  assert.equal(index.adapters[0].version, '1.0.0')
  assert.equal(index.plugins[0].total_download_count, 30)
  assert.equal(index.adapters[0].total_download_count, 30)
  assert.deepEqual((await readdir(path.join(root, 'catalogue'))).sort(), [
    'README.md', 'adapters', 'plugins',
  ])
  assert.match(await readFile(path.join(root, 'catalogue', 'plugins', 'demo-plugin.md'), 'utf8'), /# Demo/)
  for (const [kind, id] of [['plugins', 'demo-plugin'], ['adapters', 'demo-adapter']]) {
    const entryDir = path.join(root, 'meta', kind, id)
    const all = JSON.parse(await readFile(path.join(entryDir, 'all.json'), 'utf8'))
    assert.equal(all.record.id, id)
    assert.equal(all.meta.total_download_count, 30)
    const report = JSON.parse(await readFile(path.join(entryDir, 'update_report.json'), 'utf8'))
    assert.equal(report.ok, false)
  }

  await runUpdate({
    ...args,
    registrations: { plugins: [], adapters: [] },
    github: fakeGitHub(),
  })
  assert.deepEqual((await readdir(path.join(root, 'meta'))).sort(), [
    'README.md', 'authors.json', 'index.json',
  ])
  const emptyIndex = JSON.parse(await readFile(path.join(root, 'meta', 'index.json'), 'utf8'))
  assert.deepEqual(emptyIndex.plugins, [])
  assert.deepEqual(emptyIndex.adapters, [])
  assert.deepEqual(await readdir(path.join(root, 'catalogue')), ['README.md'])
})

test('removes legacy root entries without using them as fallback metadata', async (t) => {
  for (const fail of [false, true]) {
    await t.test(fail ? 'failed release fetch' : 'successful release fetch', async (t) => {
      const root = await tempRoot(t)
      const metaDir = path.join(root, 'meta')
      const args = {
        root,
        registrations: { plugins: [registration], adapters: [adapterRegistration] },
        logger: { log() {}, warn() {}, error() {} },
      }
      await runUpdate({ ...args, github: fakeGitHub() })
      const old = buildEntry('plugin', registration, fakeResolved('0.1.0'))
      for (const id of ['demo-plugin', 'removed-plugin']) {
        await mkdir(path.join(metaDir, id), { recursive: true })
        await writeFile(path.join(metaDir, id, 'all.json'), JSON.stringify(old.all))
      }
      await mkdir(path.join(metaDir, '.git'), { recursive: true })
      await writeFile(path.join(metaDir, '.git', 'HEAD'), 'preserve')

      const result = await runUpdate({ ...args, github: fakeGitHub({ fail }) })
      assert.equal(result.failed, fail ? 2 : 0)
      assert.deepEqual((await readdir(metaDir)).sort(), [
        '.git', 'README.md', 'adapters', 'authors.json', 'index.json', 'plugins',
      ])
      assert.equal(await readFile(path.join(metaDir, '.git', 'HEAD'), 'utf8'), 'preserve')
      const index = JSON.parse(await readFile(path.join(metaDir, 'index.json'), 'utf8'))
      assert.equal(index.plugins[0].version, '1.2.3')
      assert.equal(index.adapters[0].version, '1.0.0')

      await mkdir(path.join(metaDir, 'removed-plugin'), { recursive: true })
      await runUpdate({
        ...args,
        registrations: { plugins: [], adapters: [] },
        github: fakeGitHub(),
      })
      assert.deepEqual((await readdir(metaDir)).sort(), [
        '.git', 'README.md', 'authors.json', 'index.json',
      ])
    })
  }
})
