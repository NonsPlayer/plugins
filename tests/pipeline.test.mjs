import assert from 'node:assert/strict'
import test from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { buildAuthors, buildEntry, buildIndex } from '../scripts/lib/meta.mjs'
import { renderCatalogueReadme, renderPluginPage } from '../scripts/lib/markdown.mjs'
import { resolveLatestRelease } from '../scripts/lib/release.mjs'

const manifest = {
  id: 'demo-plugin',
  name: 'Demo',
  version: '1.2.3',
  description: 'A demo plugin',
  permissions: ['ui', 'storage'],
  engines: { app: '^1.0.0', pluginApi: '^2.1.0', uiApi: '^2.1.0' },
  frontend: 'ui.mjs',
}

test('runs the registration-to-catalogue pipeline with a fake release', async () => {
  const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) })
  const github = {
    async listReleases() {
      return [
        {
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
        },
      ]
    },
    async download() {
      return bytes
    },
  }

  const registration = {
    id: 'demo-plugin',
    repository: 'https://github.com/owner/repo',
    branch: 'main',
    authors: [{ name: 'Owner' }],
    license: 'MIT',
    labels: ['tool'],
    official: false,
  }

  const resolved = await resolveLatestRelease({
    github,
    owner: 'owner',
    repo: 'repo',
    pluginId: 'demo-plugin',
  })
  const entry = buildEntry(registration, resolved)
  const index = buildIndex([entry], { generatedAt: '2026-01-01T00:00:00Z' })

  assert.equal(index.plugins[0].id, 'demo-plugin')
  assert.equal(index.plugins[0].version, '1.2.3')
  assert.equal(index.plugins[0].artifact.size, bytes.length)
  assert.match(renderCatalogueReadme([entry], { generatedAt: '2026-01-01T00:00:00Z' }), /Demo/)
  assert.match(renderPluginPage(entry), /`ui`/)
  assert.deepEqual(buildAuthors([entry]).Owner.plugins, ['demo-plugin'])
})
