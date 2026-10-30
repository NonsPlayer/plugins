import assert from 'node:assert/strict'
import test from 'node:test'
import { renderAdapterPage, renderCatalogueReadme, renderPluginPage } from '../scripts/lib/markdown.mjs'

const record = {
  id: 'demo-plugin',
  repository: 'https://github.com/owner/repo',
  branch: 'main',
  authors: [{ name: 'Owner', link: 'https://github.com/owner' }],
  license: 'MIT',
  related_path: '.',
  labels: ['tool'],
  preview: null,
  introduction: {},
  deprecated: false,
  blocked: false,
}

const release = {
  releases: [
    {
      asset: {
        name: 'demo-plugin-1.2.3.zip',
        size: 1024,
        browser_download_url: 'https://example.com/demo-plugin-1.2.3.zip',
        hash_sha256: 'a'.repeat(64),
      },
    },
  ],
}

const pluginEntry = {
  kind: 'plugin',
  record,
  release,
  meta: {
    name: 'Demo',
    version: '1.2.3',
    description: 'A demo plugin',
    permissions: ['ui'],
    engines: { app: '^1.0.0', pluginApi: '^2.1.0', uiApi: '^2.1.0' },
  },
}

const adapterEntry = {
  kind: 'adapter',
  record: { ...record, id: 'demo-adapter', repository: 'https://github.com/owner/adapter' },
  release: { releases: [{ asset: { ...release.releases[0].asset, name: 'demo-adapter-1.0.0.zip' } }] },
  meta: {
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

test('renders the catalogue tables', () => {
  const markdown = renderCatalogueReadme([pluginEntry, adapterEntry], {
    generatedAt: '2026-01-01T00:00:00Z',
  })
  assert.match(markdown, /NonsPlayer 插件目录/)
  assert.match(markdown, /\[Demo\]\(\.\/plugins\/demo-plugin\.md\)/)
  assert.match(markdown, /\[Demo Adapter\]\(\.\/adapters\/demo-adapter\.md\)/)
  assert.match(markdown, /可用/)
})

test('renders a plugin page', () => {
  const markdown = renderPluginPage(pluginEntry)
  assert.match(markdown, /# Demo/)
  assert.match(markdown, /`ui`/)
  assert.match(markdown, /a{64}/)
  assert.match(markdown, /demo-plugin-1\.2\.3\.zip/)
})

test('renders an adapter page', () => {
  const markdown = renderAdapterPage(adapterEntry)
  assert.match(markdown, /# Demo Adapter/)
  assert.match(markdown, /`netease`/)
  assert.match(markdown, /HTTP：`example\.org`/)
  assert.match(markdown, /契约版本：`1`/)
  assert.match(markdown, /demo-adapter-1\.0\.0\.zip/)
})
