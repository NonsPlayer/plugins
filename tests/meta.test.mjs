import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAuthors, buildEntry, buildIndex } from '../scripts/lib/meta.mjs'

const registration = {
  id: 'demo-plugin',
  repository: 'https://github.com/owner/repo',
  branch: 'main',
  authors: [{ name: 'Owner', link: 'https://github.com/owner' }],
  license: 'MIT',
  labels: ['tool'],
}

function resolved(version = '1.2.3') {
  return {
    version,
    totalDownloadCount: 42,
    release: {
      html_url: `https://github.com/owner/repo/releases/tag/v${version}`,
      name: '',
      tag_name: `v${version}`,
      created_at: '2026-01-01T00:00:00Z',
      body: '',
      prerelease: false,
    },
    asset: {
      id: 1,
      name: `demo-plugin-${version}.zip`,
      size: 1024,
      browser_download_url: `https://example.com/demo-plugin-${version}.zip`,
      download_count: 3,
      created_at: '2026-01-01T00:00:00Z',
    },
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

const adapterRegistration = {
  ...registration,
  id: 'demo-adapter',
  repository: 'https://github.com/owner/adapter',
}

function adapterResolved() {
  const base = resolved('1.0.0')
  return {
    ...base,
    release: { ...base.release, html_url: 'https://github.com/owner/adapter/releases/tag/v1.0.0' },
    asset: {
      ...base.asset,
      name: 'demo-adapter-1.0.0.zip',
      browser_download_url: 'https://example.com/demo-adapter-1.0.0.zip',
    },
    summary: {
      id: 'demo-adapter',
      name: 'Demo Adapter',
      version: '1.0.0',
      description: 'A demo adapter',
      contractVersion: 1,
      platforms: ['netease'],
      searchPlatforms: [],
      coverHosts: [],
      permissions: {
        httpHosts: ['example.org'],
        websocketHosts: [],
        system: false,
        state: false,
        credentials: false,
      },
    },
  }
}

test('builds plugin, release and meta records', () => {
  const entry = buildEntry('plugin', registration, resolved())
  assert.equal(entry.kind, 'plugin')
  assert.equal(entry.record.id, 'demo-plugin')
  assert.equal(entry.release.latest_version, '1.2.3')
  assert.equal(entry.release.releases[0].asset.hash_sha256, 'a'.repeat(64))
  assert.equal(entry.meta.name, 'Demo')
  assert.equal(entry.meta.total_download_count, 42)
  assert.equal(entry.all.meta.total_download_count, 42)
  assert.equal(entry.release.releases[0].asset.download_count, 3)
})

test('builds an aggregate index for plugins and adapters', () => {
  const index = buildIndex([buildEntry('plugin', registration, resolved()), buildEntry('adapter', adapterRegistration, adapterResolved())], {
    generatedAt: '2026-01-01T00:00:00Z',
  })
  assert.equal(index.generated_at, '2026-01-01T00:00:00Z')
  assert.equal(index.plugins.length, 1)
  assert.equal(index.plugins[0].artifact.sha256, 'a'.repeat(64))
  assert.equal(index.plugins[0].permissions[0], 'ui')
  assert.equal(index.plugins[0].unavailable, false)
  assert.equal(index.plugins[0].total_download_count, 42)
  assert.equal(index.adapters.length, 1)
  assert.deepEqual(index.adapters[0].platforms, ['netease'])
  assert.equal(index.adapters[0].contractVersion, 1)
  assert.equal(index.adapters[0].permissions.httpHosts[0], 'example.org')
  assert.equal(index.adapters[0].total_download_count, 42)
})

test('aggregates authors per kind', () => {
  const entries = [
    buildEntry('plugin', registration, resolved()),
    buildEntry('adapter', adapterRegistration, adapterResolved()),
  ]
  const authors = buildAuthors(entries)
  assert.deepEqual(authors.Owner.plugins, ['demo-plugin'])
  assert.deepEqual(authors.Owner.adapters, ['demo-adapter'])
  assert.deepEqual(authors.Owner.links, ['https://github.com/owner'])
})

test('does not report an unknown total from old cached metadata as zero', () => {
  const entry = buildEntry('plugin', registration, resolved())
  delete entry.meta.total_download_count
  const index = JSON.parse(JSON.stringify(buildIndex([entry])))
  assert.equal(Object.hasOwn(index.plugins[0], 'total_download_count'), false)
})
