import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { validateManifest } from './manifest.mjs'
import { assertSafeRelativePath } from './paths.mjs'

async function readDirectory(dir) {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

export async function loadThirdPartyRegistrations(root) {
  const pluginsDir = path.join(root, 'plugins')
  const entries = await readDirectory(pluginsDir)
  const registrations = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = path.join(pluginsDir, entry.name)
    const file = path.join(dir, 'plugin_info.json')
    let info
    try {
      info = JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      throw new Error(`plugins/${entry.name}: cannot read plugin_info.json: ${error.message}`)
    }
    if (info.id !== entry.name) {
      throw new Error(`plugins/${entry.name}: id ${info.id} does not match the directory name`)
    }
    if (info.related_path !== undefined) {
      assertSafeRelativePath(info.related_path, 'related_path')
    }
    registrations.push({
      ...info,
      official: false,
      _dir: dir,
      _file: file,
    })
  }

  return registrations
}

export async function loadOfficialRegistrations(root, config) {
  const officialDir = path.join(root, 'official')
  const entries = await readDirectory(officialDir)
  const registrations = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = path.join(officialDir, entry.name)
    const manifestFile = path.join(dir, 'manifest.json')
    let manifest
    try {
      manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
    } catch (error) {
      throw new Error(`official/${entry.name}: cannot read manifest.json: ${error.message}`)
    }
    const errors = validateManifest(manifest, entry.name)
    if (errors.length > 0) {
      throw new Error(`official/${entry.name}: ${errors.join('; ')}`)
    }
    if (!config.repository || !config.branch) {
      throw new Error('catalogue.config.json must define repository and branch for official plugins')
    }
    registrations.push({
      id: manifest.id,
      repository: config.repository,
      branch: config.branch,
      authors: config.officialAuthors ?? [{ name: 'NonsPlayer' }],
      license: 'GPL-3.0-only',
      related_path: '.',
      labels: [],
      official: true,
      _dir: dir,
      _manifest: manifest,
    })
  }

  return registrations
}

export function publicRegistration(registration) {
  const result = {
    id: registration.id,
    repository: registration.repository,
    branch: registration.branch,
    authors: registration.authors,
    license: registration.license,
  }
  for (const key of ['related_path', 'labels', 'preview', 'introduction', 'deprecated', 'blocked']) {
    if (registration[key] !== undefined) {
      result[key] = registration[key]
    }
  }
  return result
}

export async function loadAllRegistrations(root, config) {
  const [thirdParty, official] = await Promise.all([
    loadThirdPartyRegistrations(root),
    loadOfficialRegistrations(root, config),
  ])
  const all = [...thirdParty, ...official]
  const ids = new Map()
  for (const registration of all) {
    if (ids.has(registration.id)) {
      throw new Error(`duplicate plugin id: ${registration.id}`)
    }
    ids.set(registration.id, registration)
  }
  return all
}
