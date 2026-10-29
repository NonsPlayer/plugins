import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  loadAllRegistrations,
  loadOfficialRegistrations,
  loadThirdPartyRegistrations,
  publicRegistration,
} from '../scripts/lib/registration.mjs'

const config = {
  repository: 'https://github.com/Miaoyww/plugins',
  branch: 'main',
  officialAuthors: [{ name: 'NonsPlayer' }],
}

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

const manifest = {
  id: 'demo-plugin',
  name: 'Demo',
  version: '1.0.0',
  permissions: [],
  engines: { app: '^1.0.0', pluginApi: '^2.1.0', uiApi: '^2.1.0' },
  frontend: 'ui.mjs',
}

async function writeRegistration(root, value = registration) {
  const dir = path.join(root, 'plugins', value.id)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'plugin_info.json'), JSON.stringify(value))
}

async function writeOfficial(root, value = manifest) {
  const dir = path.join(root, 'official', value.id)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(value))
}

test('loads a third-party registration', async (t) => {
  const root = await tempRoot(t)
  await writeRegistration(root)
  const registrations = await loadThirdPartyRegistrations(root)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].id, 'demo-plugin')
  assert.equal(registrations[0].official, false)
  assert.equal(publicRegistration(registrations[0])._dir, undefined)
})

test('rejects an id that does not match the directory', async (t) => {
  const root = await tempRoot(t)
  const dir = path.join(root, 'plugins', 'other-directory')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'plugin_info.json'), JSON.stringify(registration))
  await assert.rejects(() => loadThirdPartyRegistrations(root), /does not match/)
})

test('loads an official plugin and synthesizes its registration', async (t) => {
  const root = await tempRoot(t)
  await writeOfficial(root)
  const registrations = await loadOfficialRegistrations(root, config)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].official, true)
  assert.equal(registrations[0].repository, config.repository)
})

test('rejects duplicate ids across official and third-party plugins', async (t) => {
  const root = await tempRoot(t)
  await writeRegistration(root)
  await writeOfficial(root)
  await assert.rejects(() => loadAllRegistrations(root, config), /duplicate plugin id/)
})
