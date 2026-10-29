import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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

function fakeGitHub({ fail = false } = {}) {
  return {
    async listReleases(owner, repo) {
      if (fail) throw new Error('network down')
      if (repo === 'repo') return [pluginRelease()]
      if (repo === 'adapter') return [adapterRelease()]
      return []
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
  assert.equal(index.adapters[0].id, 'demo-adapter')
  assert.deepEqual(index.adapters[0].platforms, ['netease'])

  const all = JSON.parse(await readFile(path.join(root, 'meta', 'demo-plugin', 'all.json'), 'utf8'))
  assert.equal(all.release.latest_version, '1.2.3')
  const adapterAll = JSON.parse(
    await readFile(path.join(root, 'meta', 'adapters', 'demo-adapter', 'all.json'), 'utf8'),
  )
  assert.equal(adapterAll.release.latest_version, '1.0.0')
  assert.equal(adapterAll.record.id, 'demo-adapter')

  const readme = await readFile(path.join(root, 'catalogue', 'README.md'), 'utf8')
  assert.match(readme, /Demo/)
  assert.match(readme, /Demo Adapter/)
  const page = await readFile(path.join(root, 'catalogue', 'adapters', 'demo-adapter.md'), 'utf8')
  assert.match(page, /契约版本/)
})

test('keeps previous metadata on failure and removes stale entries', async (t) => {
  const root = await tempRoot(t)
  const previous = buildEntry('plugin', registration, fakeResolved('1.0.0'))
  await mkdir(path.join(root, 'meta', 'demo-plugin'), { recursive: true })
  await writeFile(path.join(root, 'meta', 'demo-plugin', 'all.json'), JSON.stringify(previous.all))
  await mkdir(path.join(root, 'meta', 'old-plugin'), { recursive: true })
  await writeFile(path.join(root, 'meta', 'old-plugin', 'all.json'), JSON.stringify(previous.all))

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

  const report = JSON.parse(await readFile(path.join(root, 'meta', 'demo-plugin', 'update_report.json'), 'utf8'))
  assert.equal(report.ok, false)
  assert.match(report.error, /network down/)

  await assert.rejects(access(path.join(root, 'meta', 'old-plugin')))
})
