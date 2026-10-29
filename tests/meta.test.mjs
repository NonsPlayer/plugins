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
  official: false,
}

const resolved = {
  version: '1.2.3',
  release: {
    html_url: 'https://github.com/owner/repo/releases/tag/v1.2.3',
    name: '',
    tag_name: 'v1.2.3',
    created_at: '2026-01-01T00:00:00Z',
    body: '',
    prerelease: false,
  },
  asset: {
    id: 1,
    name: 'demo-plugin-1.2.3.zip',
    size: 1024,
    browser_download_url: 'https://github.com/owner/repo/releases/download/v1.2.3/demo-plugin-1.2.3.zip',
    download_count: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
  summary: {
    id: 'demo-plugin',
    name: 'Demo',
    version: '1.2.3',
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

test('builds plugin, release and meta records', () => {
  const entry = buildEntry(registration, resolved)
  assert.equal(entry.plugin.id, 'demo-plugin')
  assert.equal(entry.release.latest_version, '1.2.3')
  assert.equal(entry.release.releases[0].asset.hash_sha256, 'a'.repeat(64))
  assert.equal(entry.meta.name, 'Demo')
})

test('builds an aggregate index', () => {
  const entry = buildEntry(registration, resolved)
  const index = buildIndex([entry], { generatedAt: '2026-01-01T00:00:00Z' })
  assert.equal(index.generated_at, '2026-01-01T00:00:00Z')
  assert.equal(index.plugins.length, 1)
  assert.equal(index.plugins[0].artifact.sha256, 'a'.repeat(64))
  assert.equal(index.plugins[0].permissions[0], 'ui')
  assert.equal(index.plugins[0].unavailable, false)
})

test('aggregates authors', () => {
  const entry = buildEntry(registration, resolved)
  const authors = buildAuthors([entry])
  assert.deepEqual(authors.Owner.plugins, ['demo-plugin'])
  assert.deepEqual(authors.Owner.links, ['https://github.com/owner'])
})
