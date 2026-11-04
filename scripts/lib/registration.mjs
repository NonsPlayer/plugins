import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { assertSafeRelativePath } from './paths.mjs'

const KINDS = {
  plugin: { directory: 'plugins', file: 'plugin_info.json' },
  adapter: { directory: 'adapters', file: 'adapter_info.json' },
}

async function readDirectory(dir) {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function loadKind(root, kind, { tolerant = false, errors = [] } = {}) {
  const spec = KINDS[kind]
  const base = path.join(root, spec.directory)
  const entries = await readDirectory(base)
  const registrations = []

  const report = (entry, error) => {
    const message = `${spec.directory}/${entry.name}: ${error.message}`
    if (!tolerant) throw new Error(message)
    errors.push({ id: entry.name, kind, message: error.message })
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = path.join(base, entry.name)
    const file = path.join(dir, spec.file)
    let info
    try {
      info = JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      report(entry, new Error(`cannot read ${spec.file}: ${error.message}`))
      continue
    }
    if (info.id !== entry.name) {
      report(entry, new Error(`id ${info.id} does not match the directory name`))
      continue
    }
    if (info.related_path !== undefined) {
      try {
        assertSafeRelativePath(info.related_path, 'related_path')
      } catch (error) {
        report(entry, error)
        continue
      }
    }
    registrations.push({
      ...info,
      kind,
      _dir: dir,
      _file: file,
    })
  }

  return registrations
}

export const loadPluginRegistrations = (root, options) => loadKind(root, 'plugin', options)
export const loadAdapterRegistrations = (root, options) => loadKind(root, 'adapter', options)

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
  if (registration.kind === 'adapter' && registration.distribution !== undefined) {
    result.distribution = registration.distribution
  }
  return result
}

export async function loadAllRegistrations(root, options = {}) {
  const errors = []
  const [plugins, adapters] = await Promise.all([
    loadPluginRegistrations(root, { ...options, errors }),
    loadAdapterRegistrations(root, { ...options, errors }),
  ])
  return { plugins, adapters, errors }
}
