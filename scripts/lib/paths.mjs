import path from 'node:path'

export function assertSafeRelativePath(value, label = 'path') {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  if (value.includes('\\')) {
    throw new Error(`${label} must use forward slashes`)
  }
  if (value.startsWith('/')) {
    throw new Error(`${label} must be relative`)
  }
  const normalized = path.posix.normalize(value)
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`${label} must not escape the plugin directory`)
  }
  return normalized
}

export function resolveInside(base, relative, label = 'path') {
  const normalized = assertSafeRelativePath(relative, label)
  const baseResolved = path.resolve(base)
  const resolved = path.resolve(baseResolved, normalized)
  if (resolved !== baseResolved && !resolved.startsWith(`${baseResolved}${path.sep}`)) {
    throw new Error(`${label} must stay inside the plugin directory`)
  }
  return resolved
}

export function toPosix(value) {
  return value.split(path.sep).join('/')
}
