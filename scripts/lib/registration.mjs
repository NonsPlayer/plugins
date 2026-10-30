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

async function loadKind(root, kind) {
  const spec = KINDS[kind]
  const base = path.join(root, spec.directory)
  const entries = await readDirectory(base)
  const registrations = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = path.join(base, entry.name)
    const file = path.join(dir, spec.file)
    let info
    try {
      info = JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      throw new Error(`${spec.directory}/${entry.name}: cannot read ${spec.file}: ${error.message}`)
    }
    if (info.id !== entry.name) {
      throw new Error(`${spec.directory}/${entry.name}: id ${info.id} does not match the directory name`)
    }
    if (info.related_path !== undefined) {
      assertSafeRelativePath(info.related_path, 'related_path')
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

export const loadPluginRegistrations = (root) => loadKind(root, 'plugin')
export const loadAdapterRegistrations = (root) => loadKind(root, 'adapter')

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

export async function loadAllRegistrations(root) {
  const [plugins, adapters] = await Promise.all([
    loadPluginRegistrations(root),
    loadAdapterRegistrations(root),
  ])
  return { plugins, adapters }
}
