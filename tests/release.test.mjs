import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { MAX_ASSET_BYTES, parseTagVersion, pickAsset, resolveLatestRelease } from '../scripts/lib/release.mjs'

const manifest = {
  id: 'demo-plugin',
  name: 'Demo',
  version: '1.2.3',
  permissions: ['ui'],
  engines: { app: '^1.0.0', pluginApi: '^2.1.0', uiApi: '^2.1.0' },
  frontend: 'ui.mjs',
}

function makeAsset(overrides = {}) {
  const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) })
  return {
    bytes,
    asset: {
      id: 1,
      name: 'demo-plugin-1.2.3.zip',
      size: bytes.length,
      browser_download_url: 'https://example.com/demo-plugin-1.2.3.zip',
      download_count: 0,
      created_at: '2026-01-01T00:00:00Z',
      ...overrides,
    },
  }
}

function makeRelease(asset, overrides = {}) {
  return {
    draft: false,
    prerelease: false,
    tag_name: 'v1.2.3',
    html_url: 'https://example.com/releases/v1.2.3',
    name: '',
    body: '',
    created_at: '2026-01-01T00:00:00Z',
    assets: [asset],
    ...overrides,
  }
}

test('parses supported tag formats', () => {
  assert.equal(parseTagVersion('v1.2.3', 'demo-plugin'), '1.2.3')
  assert.equal(parseTagVersion('demo-plugin-1.2.3', 'demo-plugin'), '1.2.3')
  assert.equal(parseTagVersion('1.2.3', 'demo-plugin'), '1.2.3')
  assert.equal(parseTagVersion('release-1.2.3', 'demo-plugin'), null)
})

test('prefers an asset named after the plugin', () => {
  const { asset } = makeAsset()
  const release = makeRelease(asset, {
    assets: [
      { ...asset, id: 2, name: 'other.zip' },
      asset,
    ],
  })
  assert.equal(pickAsset(release, 'demo-plugin').id, 1)
})

test('resolves the latest valid release and hashes the asset', async () => {
  const { bytes, asset } = makeAsset()
  const github = {
    async listReleases() {
      return [makeRelease(asset)]
    },
    async download() {
      return bytes
    },
  }
  const resolved = await resolveLatestRelease({ github, owner: 'owner', repo: 'repo', pluginId: 'demo-plugin' })
  assert.equal(resolved.version, '1.2.3')
  assert.equal(resolved.summary.id, 'demo-plugin')
  assert.equal(resolved.sha256, createHash('sha256').update(bytes).digest('hex'))
  assert.equal(resolved.md5, createHash('md5').update(bytes).digest('hex'))
  assert.equal(resolved.totalDownloadCount, 0)
})

test('totals all eligible release assets beyond the candidate limit without downloading history', async () => {
  const { bytes, asset } = makeAsset({ download_count: 7 })
  const downloads = []
  const older = Array.from({ length: 25 }, (_, index) => makeRelease(
    { ...asset, download_count: 2 },
    { tag_name: `v1.0.${index}` },
  ))
  const github = {
    async listReleases() {
      return [
        ...older,
        makeRelease(asset, { assets: [
          { ...asset, name: 'other.zip', download_count: 1000 },
          asset,
          { ...asset, name: 'demo-plugin-debug.zip', download_count: 1000 },
        ] }),
        makeRelease({ ...asset, download_count: undefined }, { tag_name: 'v0.9.0' }),
        makeRelease({ ...asset, download_count: null }, { tag_name: 'v0.8.0' }),
        makeRelease(asset, { draft: true }),
        makeRelease(asset, { prerelease: true }),
        makeRelease(asset, { tag_name: 'invalid' }),
        makeRelease({ ...asset, name: 'notes.txt' }),
        makeRelease({ ...asset, size: MAX_ASSET_BYTES + 1 }),
        makeRelease(asset, { assets: [] }),
      ]
    },
    async download(url) {
      downloads.push(url)
      return bytes
    },
  }
  const resolved = await resolveLatestRelease({
    github, owner: 'owner', repo: 'repo', pluginId: 'demo-plugin', maxReleases: 1,
  })
  assert.equal(resolved.totalDownloadCount, 57)
  assert.equal(resolved.history.length, 1)
  assert.deepEqual(downloads, [asset.browser_download_url])
})

test('skips a broken release and uses the previous one', async () => {
  const { bytes, asset } = makeAsset({ download_count: 5 })
  const broken = makeAsset({ name: 'demo-plugin-1.3.0.zip', download_count: 11 })
  const brokenBytes = zipSync({ 'manifest.json': strToU8(JSON.stringify({ ...manifest, version: '9.9.9' })) })
  const releases = [
    makeRelease({ ...broken.asset, id: 2 }, { tag_name: 'v1.3.0' }),
    makeRelease(asset),
  ]
  const github = {
    async listReleases() {
      return releases
    },
    async download(url) {
      return url.includes('1.3.0') ? brokenBytes : bytes
    },
  }
  const resolved = await resolveLatestRelease({ github, owner: 'owner', repo: 'repo', pluginId: 'demo-plugin' })
  assert.equal(resolved.version, '1.2.3')
  assert.equal(resolved.asset.download_count, 5)
  assert.equal(resolved.totalDownloadCount, 16)
})

test('throws when no valid release exists', async () => {
  const { asset } = makeAsset()
  const github = {
    async listReleases() {
      return [makeRelease(asset, { prerelease: true })]
    },
    async download() {
      throw new Error('should not be called')
    },
  }
  await assert.rejects(
    () => resolveLatestRelease({ github, owner: 'owner', repo: 'repo', pluginId: 'demo-plugin' }),
    /no valid release/,
  )
})

test('resolves an adapter release from its manifest version and descriptor', async () => {
  const adapterManifest = {
    version: '1.0.0',
    resourceProvider: {
      id: 'demo-adapter',
      displayName: 'Demo Adapter',
      contractVersion: 1,
      platforms: ['netease'],
    },
    permissions: { httpHosts: ['example.org'], websocketHosts: [] },
  }
  const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify(adapterManifest)) })
  const asset = {
    id: 3,
    name: 'demo-adapter-1.0.0.zip',
    size: bytes.length,
    browser_download_url: 'https://example.com/demo-adapter-1.0.0.zip',
    download_count: 0,
    created_at: '2026-01-01T00:00:00Z',
  }
  const github = {
    async listReleases() {
      return [makeRelease(asset, { tag_name: 'v1.0.0' })]
    },
    async download() {
      return bytes
    },
  }
  const resolved = await resolveLatestRelease({
    github,
    owner: 'owner',
    repo: 'adapter',
    pluginId: 'demo-adapter',
    kind: 'adapter',
  })
  assert.equal(resolved.version, '1.0.0')
  assert.equal(resolved.summary.name, 'Demo Adapter')
  assert.deepEqual(resolved.summary.platforms, ['netease'])
})

test('rejects an adapter whose tag and manifest version differ', async () => {
  const adapterManifest = {
    version: '1.0.0',
    resourceProvider: {
      id: 'demo-adapter',
      displayName: 'Demo Adapter',
      contractVersion: 1,
      platforms: ['netease'],
    },
    permissions: { httpHosts: [] },
  }
  const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify(adapterManifest)) })
  const asset = {
    id: 4,
    name: 'demo-adapter-1.1.0.zip',
    size: bytes.length,
    browser_download_url: 'https://example.com/demo-adapter-1.1.0.zip',
  }
  const github = {
    async listReleases() {
      return [makeRelease(asset, { tag_name: 'v1.1.0' })]
    },
    async download() {
      return bytes
    },
  }
  await assert.rejects(
    () =>
      resolveLatestRelease({
        github,
        owner: 'owner',
        repo: 'adapter',
        pluginId: 'demo-adapter',
        kind: 'adapter',
      }),
    /does not match manifest version/,
  )
})
