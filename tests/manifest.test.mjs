import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adapterSummary,
  manifestSummary,
  validateAdapterManifest,
  validateManifest,
} from '../scripts/lib/manifest.mjs'

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

const adapterManifest = {
  version: '1.0.0',
  resourceProvider: {
    id: 'demo-adapter',
    displayName: 'Demo Adapter',
    description: 'A demo adapter',
    contractVersion: 1,
    platforms: ['netease'],
    searchPlatforms: [],
    coverHosts: ['cdn.example.org'],
  },
  permissions: {
    httpHosts: ['example.org'],
    websocketHosts: [],
    system: true,
    state: false,
    credentials: false,
  },
}

test('accepts a valid adapter manifest', () => {
  assert.deepEqual(validateAdapterManifest(adapterManifest, 'demo-adapter'), [])
  const summary = adapterSummary(adapterManifest)
  assert.equal(summary.id, 'demo-adapter')
  assert.deepEqual(summary.platforms, ['netease'])
  assert.deepEqual(summary.permissions.httpHosts, ['example.org'])
  assert.equal(summary.permissions.system, true)
})

test('accepts a platform descriptor adapter', () => {
  const platform = {
    version: '2.0.0',
    descriptor: {
      source: 'demo-platform',
      displayName: 'Demo Platform',
      contractVersion: 1,
      platforms: ['demo'],
      capabilities: ['search'],
    },
    permissions: { httpHosts: [], websocketHosts: [], system: false, state: true, credentials: true },
  }
  assert.deepEqual(validateAdapterManifest(platform, 'demo-platform'), [])
  assert.equal(adapterSummary(platform).id, 'demo-platform')
})

test('requires an adapter version and a single descriptor', () => {
  const { version: _version, ...noVersion } = adapterManifest
  assert.match(validateAdapterManifest(noVersion).join('; '), /version/)
  const both = {
    ...adapterManifest,
    descriptor: { source: 'demo-adapter', displayName: 'Demo', contractVersion: 1 },
  }
  assert.match(validateAdapterManifest(both).join('; '), /exactly one/)
  assert.match(validateAdapterManifest(adapterManifest, 'other').join('; '), /does not match/)
})
