import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  loadAdapterRegistrations,
  loadAllRegistrations,
  loadPluginRegistrations,
  publicRegistration,
} from '../scripts/lib/registration.mjs'

async function tempRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nons-catalogue-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

const registration = {
  id: 'demo-plugin',
  repository: 'https://github.com/owner/repo',
  branch: 'main',
  authors: [{ name: 'Owner' }],
  license: 'MIT',
}

async function writeRegistration(root, kind, value) {
  const spec =
    kind === 'adapter'
      ? { directory: 'adapters', file: 'adapter_info.json' }
      : { directory: 'plugins', file: 'plugin_info.json' }
  const dir = path.join(root, spec.directory, value.id)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, spec.file), JSON.stringify(value))
}

test('loads a plugin registration', async (t) => {
  const root = await tempRoot(t)
  await writeRegistration(root, 'plugin', registration)
  const registrations = await loadPluginRegistrations(root)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].id, 'demo-plugin')
  assert.equal(registrations[0].kind, 'plugin')
  assert.equal(publicRegistration(registrations[0])._dir, undefined)
})

test('loads an adapter registration', async (t) => {
  const root = await tempRoot(t)
  await writeRegistration(root, 'adapter', { ...registration, id: 'demo-adapter' })
  const registrations = await loadAdapterRegistrations(root)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].kind, 'adapter')
})

test('rejects an id that does not match the directory', async (t) => {
  const root = await tempRoot(t)
  const dir = path.join(root, 'plugins', 'other-directory')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'plugin_info.json'), JSON.stringify(registration))
  await assert.rejects(() => loadPluginRegistrations(root), /does not match/)
})

test('loads plugins and adapters independently', async (t) => {
  const root = await tempRoot(t)
  await writeRegistration(root, 'plugin', registration)
  await writeRegistration(root, 'adapter', { ...registration, id: 'demo-adapter' })
  const loaded = await loadAllRegistrations(root)
  assert.deepEqual(
    loaded.plugins.map((item) => item.id),
    ['demo-plugin'],
  )
  assert.deepEqual(
    loaded.adapters.map((item) => item.id),
    ['demo-adapter'],
  )
})

test('collects invalid registrations without dropping valid ones', async (t) => {
  const root = await tempRoot(t)
  await writeRegistration(root, 'plugin', registration)
  const broken = path.join(root, 'plugins', 'broken-plugin')
  await mkdir(broken, { recursive: true })
  await writeFile(path.join(broken, 'plugin_info.json'), '{')

  const loaded = await loadAllRegistrations(root, { tolerant: true })
  assert.deepEqual(
    loaded.plugins.map((item) => item.id),
    ['demo-plugin'],
  )
  assert.equal(loaded.errors.length, 1)
  assert.equal(loaded.errors[0].id, 'broken-plugin')
  assert.equal(loaded.errors[0].kind, 'plugin')
  assert.match(loaded.errors[0].message, /cannot read plugin_info\.json/)
})

test('skips a leftover directory whose registration file was deleted', async (t) => {
  const root = await tempRoot(t)
  await writeRegistration(root, 'plugin', registration)
  const leftover = path.join(root, 'adapters', 'removed-adapter')
  await mkdir(leftover, { recursive: true })
  await writeFile(path.join(leftover, 'introduction-zh_cn.md'), '介绍')

  const loaded = await loadAllRegistrations(root, { tolerant: true })
  assert.deepEqual(
    loaded.plugins.map((item) => item.id),
    ['demo-plugin'],
  )
  assert.deepEqual(loaded.adapters, [])
  assert.deepEqual(loaded.errors, [])
})
