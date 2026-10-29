import assert from 'node:assert/strict'
import test from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { readManifestFromZip } from '../scripts/lib/zip.mjs'

const manifest = {
  id: 'demo-plugin',
  name: 'Demo',
  version: '1.0.0',
  permissions: [],
  engines: { app: '^1.0.0', pluginApi: '^2.1.0', uiApi: '^2.1.0' },
  frontend: 'ui.mjs',
}

test('reads manifest.json from the archive root', () => {
  const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) })
  assert.deepEqual(readManifestFromZip(bytes), manifest)
})

test('rejects a nested manifest.json', () => {
  const bytes = zipSync({ 'demo-plugin/manifest.json': strToU8(JSON.stringify(manifest)) })
  assert.throws(() => readManifestFromZip(bytes), /ZIP root/)
})

test('rejects invalid JSON', () => {
  const bytes = zipSync({ 'manifest.json': strToU8('{') })
  assert.throws(() => readManifestFromZip(bytes), /not valid JSON/)
})

test('rejects a manifest larger than 64 KiB', () => {
  const bytes = zipSync({
    'manifest.json': strToU8(JSON.stringify({ ...manifest, description: 'x'.repeat(70 * 1024) })),
  })
  assert.throws(() => readManifestFromZip(bytes), /max 64 KiB/)
})
