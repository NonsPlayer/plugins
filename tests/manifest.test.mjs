import assert from 'node:assert/strict'
import test from 'node:test'
import { manifestSummary, validateManifest } from '../scripts/lib/manifest.mjs'

const manifest = {
  id: 'demo-plugin',
  name: 'Demo',
  version: '1.2.3',
  description: 'A demo plugin',
  permissions: ['ui', 'storage'],
  engines: { app: '^1.0.0', pluginApi: '^2.1.0', uiApi: '^2.1.0' },
  frontend: 'ui.mjs',
}

test('accepts a valid manifest', () => {
  assert.deepEqual(validateManifest(manifest, 'demo-plugin'), [])
})

test('rejects an id mismatch', () => {
  assert.match(validateManifest(manifest, 'other-plugin').join('; '), /does not match/)
})

test('rejects an invalid version', () => {
  assert.match(validateManifest({ ...manifest, version: 'one' }).join('; '), /SemVer/)
})

test('requires engines', () => {
  const { engines: _engines, ...rest } = manifest
  assert.match(validateManifest(rest).join('; '), /engines/)
})

test('requires an entry point', () => {
  const { frontend: _frontend, ...rest } = manifest
  assert.match(validateManifest(rest).join('; '), /backend or frontend/)
})

test('rejects a backend that is not WASM', () => {
  assert.match(validateManifest({ ...manifest, frontend: undefined, backend: 'backend.js' }).join('; '), /\.wasm/)
})

test('summarizes the manifest', () => {
  const summary = manifestSummary(manifest)
  assert.equal(summary.id, 'demo-plugin')
  assert.equal(summary.frontend, 'ui.mjs')
  assert.deepEqual(summary.permissions, ['ui', 'storage'])
})
