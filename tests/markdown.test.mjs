import assert from 'node:assert/strict'
import test from 'node:test'
import { renderCatalogueReadme, renderPluginPage } from '../scripts/lib/markdown.mjs'

const entry = {
  plugin: {
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
    official: false,
  },
  release: {
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
  },
  meta: {
    name: 'Demo',
    version: '1.2.3',
    description: 'A demo plugin',
    permissions: ['ui'],
    engines: { app: '^1.0.0', pluginApi: '^2.1.0', uiApi: '^2.1.0' },
  },
}

test('renders the catalogue table', () => {
  const markdown = renderCatalogueReadme([entry], { generatedAt: '2026-01-01T00:00:00Z' })
  assert.match(markdown, /NonsPlayer 插件目录/)
  assert.match(markdown, /\[Demo\]\(\.\/demo-plugin\.md\)/)
  assert.match(markdown, /社区/)
})

test('renders a plugin page', () => {
  const markdown = renderPluginPage(entry)
  assert.match(markdown, /# Demo/)
  assert.match(markdown, /`ui`/)
  assert.match(markdown, /a{64}/)
  assert.match(markdown, /demo-plugin-1\.2\.3\.zip/)
})
