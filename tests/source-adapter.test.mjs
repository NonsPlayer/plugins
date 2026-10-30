import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { buildEntry, buildIndex } from '../scripts/lib/meta.mjs'
import { renderAdapterPage, renderCatalogueReadme } from '../scripts/lib/markdown.mjs'
import { publicRegistration } from '../scripts/lib/registration.mjs'
import { resolveLatestRelease } from '../scripts/lib/release.mjs'
import { loadRegistrationValidator } from '../scripts/lib/schema.mjs'
import { runUpdate } from '../scripts/lib/update-runner.mjs'

const registration = {
  kind: 'adapter',
  id: 'native-adapter',
  repository: 'https://github.com/owner/native-adapter',
  branch: 'main',
  authors: [{ name: 'Owner' }],
  license: 'MIT',
  distribution: 'source',
}
const manifest = {
  version: '1.0.0',
  source: { id: 'native-adapter', name: 'Native Adapter', description: 'Native Rust library' },
}

function githubFor(value = manifest) {
  const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify(value)), 'src/lib.rs': strToU8('') })
  return {
    async listReleases() {
      return [{
        tag_name: 'v1.0.0',
        html_url: 'https://github.com/owner/native-adapter/releases/tag/v1.0.0',
        assets: [{ name: 'native-adapter-1.0.0.zip', size: bytes.length, browser_download_url: 'https://example.org/source.zip', download_count: 13 }],
      }]
    },
    async download() { return bytes },
  }
}

const resolve = (github, distribution = 'source') => resolveLatestRelease({
  github, owner: 'owner', repo: 'native-adapter', pluginId: registration.id, kind: 'adapter', distribution,
})

test('validates source registration and preserves its distribution', async () => {
  const validator = await loadRegistrationValidator(new URL('../schemas/adapter_info.schema.json', import.meta.url))
  assert.equal(validator(publicRegistration(registration)), true)
  assert.equal(publicRegistration(registration).distribution, 'source')
  assert.equal(validator({ ...publicRegistration(registration), distribution: 'native' }), false)
})

test('source releases cannot be interpreted as installable components', async () => {
  const resolved = await resolve(githubFor())
  const entry = buildEntry('adapter', registration, resolved)
  const index = buildIndex([entry]).adapters[0]
  assert.equal(index.installable, false)
  assert.equal(index.distribution, 'source')
  assert.equal(index.artifact, null)
  assert.equal(index.sourceArtifact.sha256, resolved.sha256)
  assert.equal(index.contractVersion, undefined)
  assert.equal(index.total_download_count, 13)
  assert.equal(entry.meta.total_download_count, 13)
  await assert.rejects(resolve(githubFor(), 'component'), /no valid release/)
  assert.match(renderAdapterPage(entry), /源码下载/)
  assert.match(renderCatalogueReadme([entry], { generatedAt: '2026-10-30' }), /不可安装/)
  assert.doesNotMatch(renderAdapterPage(entry), /契约版本|## 权限/)
})

test('rejects mismatched identity, version, and mixed source/component declarations', async () => {
  for (const value of [
    { ...manifest, source: { ...manifest.source, id: 'different' } },
    { ...manifest, version: '2.0.0' },
    { ...manifest, descriptor: {} },
    { ...manifest, source: { id: manifest.source.id } },
  ]) {
    await assert.rejects(resolve(githubFor(value)), /no valid release/)
  }
})

test('update pipeline writes and preserves non-installable source metadata on failure', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nons-source-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const args = {
    root, registrations: { plugins: [], adapters: [registration] },
    logger: { log() {}, warn() {}, error() {} },
  }
  const result = await runUpdate({ ...args, github: githubFor() })
  assert.equal(result.failed, 0)
  const file = path.join(root, 'meta', 'index.json')
  const index = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(index.adapters[0].installable, false)
  assert.equal(index.adapters[0].sourceArtifact.url, 'https://example.org/source.zip')
  assert.equal(index.adapters[0].total_download_count, 13)
  const failed = await runUpdate({ ...args, github: { async listReleases() { throw new Error('offline') } } })
  assert.equal(failed.failed, 1)
  assert.equal(JSON.parse(await readFile(file, 'utf8')).adapters[0].artifact, null)
  assert.equal(JSON.parse(await readFile(file, 'utf8')).adapters[0].total_download_count, 13)
  const page = await readFile(path.join(root, 'catalogue', 'adapters', 'native-adapter.md'), 'utf8')
  assert.match(page, /不可安装/)
})
