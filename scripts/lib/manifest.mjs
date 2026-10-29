import semver from 'semver'
import { assertSafeRelativePath } from './paths.mjs'

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateManifest(manifest, expectedId) {
  const errors = []
  if (!isPlainObject(manifest)) {
    return ['manifest must be a JSON object']
  }

  if (typeof manifest.id !== 'string' || !ID_PATTERN.test(manifest.id)) {
    errors.push('manifest.id must match ^[a-z][a-z0-9-]{0,63}$')
  } else if (expectedId && manifest.id !== expectedId) {
    errors.push(`manifest.id ${manifest.id} does not match registration id ${expectedId}`)
  }

  if (typeof manifest.name !== 'string' || manifest.name.trim().length === 0) {
    errors.push('manifest.name is required')
  }

  if (typeof manifest.version !== 'string' || semver.valid(manifest.version) === null) {
    errors.push('manifest.version must be a valid SemVer')
  }

  if (manifest.description !== undefined) {
    if (typeof manifest.description !== 'string' || manifest.description.length === 0 || manifest.description.length > 1024) {
      errors.push('manifest.description must be a non-empty string of at most 1024 characters')
    }
  }

  if (!Array.isArray(manifest.permissions) || !manifest.permissions.every((permission) => typeof permission === 'string')) {
    errors.push('manifest.permissions must be an array of strings')
  }

  if (!isPlainObject(manifest.engines)) {
    errors.push('manifest.engines is required')
  } else {
    for (const key of ['app', 'pluginApi', 'uiApi']) {
      const range = manifest.engines[key]
      if (typeof range !== 'string' || semver.validRange(range) === null) {
        errors.push(`manifest.engines.${key} must be a valid SemVer range`)
      }
    }
  }

  if (!manifest.backend && !manifest.frontend) {
    errors.push('manifest must declare backend or frontend')
  }

  for (const key of ['backend', 'frontend']) {
    if (manifest[key] === undefined) continue
    if (typeof manifest[key] !== 'string') {
      errors.push(`manifest.${key} must be a string`)
      continue
    }
    if (key === 'backend' && !manifest[key].endsWith('.wasm')) {
      errors.push('manifest.backend must end with .wasm')
    }
    if (key === 'frontend' && !manifest[key].endsWith('.mjs')) {
      errors.push('manifest.frontend must end with .mjs')
    }
    try {
      assertSafeRelativePath(manifest[key], `manifest.${key}`)
    } catch (error) {
      errors.push(error.message)
    }
  }

  for (const key of ['httpHosts', 'fileRoots']) {
    if (manifest[key] === undefined) continue
    if (!Array.isArray(manifest[key]) || !manifest[key].every((value) => typeof value === 'string')) {
      errors.push(`manifest.${key} must be an array of strings`)
    }
  }

  return errors
}

export function manifestSummary(manifest) {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description ?? null,
    permissions: manifest.permissions,
    httpHosts: manifest.httpHosts ?? null,
    fileRoots: manifest.fileRoots ?? null,
    engines: manifest.engines,
    backend: manifest.backend ?? null,
    frontend: manifest.frontend ?? null,
  }
}
