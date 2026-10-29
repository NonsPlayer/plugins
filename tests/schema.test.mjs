import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { formatAjvErrors, loadRegistrationValidator } from '../scripts/lib/schema.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const validator = await loadRegistrationValidator(path.join(root, 'schemas/plugin_info.schema.json'))

const valid = {
  id: 'demo-plugin',
  repository: 'https://github.com/owner/repo',
  branch: 'main',
  authors: [{ name: 'Owner', link: 'https://github.com/owner' }],
  license: 'GPL-3.0-only',
  related_path: '.',
  labels: ['tool'],
  preview: 'https://example.com/preview.png',
  introduction: { 'zh-CN': 'introduction.md' },
}

test('accepts a complete registration', () => {
  assert.equal(validator(valid), true, formatAjvErrors(validator.errors))
})

test('accepts a minimal registration', () => {
  const minimal = {
    id: 'minimal-plugin',
    repository: 'https://github.com/owner/repo',
    branch: 'main',
    authors: [{ name: 'Owner' }],
    license: 'MIT',
  }
  assert.equal(validator(minimal), true, formatAjvErrors(validator.errors))
})

test('rejects a missing license', () => {
  const { license: _license, ...rest } = valid
  assert.equal(validator(rest), false)
})

test('rejects an invalid id', () => {
  assert.equal(validator({ ...valid, id: 'Demo' }), false)
})

test('rejects unknown fields', () => {
  assert.equal(validator({ ...valid, extra: true }), false)
})

test('rejects an unsafe related_path', () => {
  assert.equal(validator({ ...valid, related_path: '../outside' }), false)
})

test('rejects a license outside the whitelist', () => {
  assert.equal(validator({ ...valid, license: 'WTFPL' }), false)
})

test('accepts the same shape for adapter registrations', async () => {
  const adapter = await loadRegistrationValidator(path.join(root, 'schemas/adapter_info.schema.json'))
  assert.equal(adapter(valid), true, formatAjvErrors(adapter.errors))
  assert.equal(adapter({ ...valid, extra: true }), false)
})
