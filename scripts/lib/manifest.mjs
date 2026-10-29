import semver from 'semver'
import { assertSafeRelativePath } from './paths.mjs'

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
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

export function adapterDescriptor(manifest) {
  if (!isPlainObject(manifest)) return null
  if (isPlainObject(manifest.descriptor)) {
    return { kind: 'platform', value: manifest.descriptor, id: manifest.descriptor.source }
  }
  if (isPlainObject(manifest.resourceProvider)) {
    return { kind: 'provider', value: manifest.resourceProvider, id: manifest.resourceProvider.id }
  }
  return null
}

export function validateAdapterManifest(manifest, expectedId) {
  if (!isPlainObject(manifest)) return ['manifest must be a JSON object']

  const errors = []
  if (typeof manifest.version !== 'string' || semver.valid(manifest.version) === null) {
    errors.push('manifest.version must be a valid SemVer')
  }

  const hasDescriptor = isPlainObject(manifest.descriptor)
  const hasProvider = isPlainObject(manifest.resourceProvider)
  if (hasDescriptor === hasProvider) {
    errors.push('manifest must declare exactly one of descriptor or resourceProvider')
    return errors
  }

  const descriptor = adapterDescriptor(manifest)
  if (typeof descriptor.id !== 'string' || !ID_PATTERN.test(descriptor.id)) {
    errors.push(`${hasDescriptor ? 'descriptor.source' : 'resourceProvider.id'} must match ^[a-z][a-z0-9-]{0,63}$`)
  } else if (expectedId && descriptor.id !== expectedId) {
    errors.push(`adapter id ${descriptor.id} does not match registration id ${expectedId}`)
  }

  const value = descriptor.value
  if (typeof value.displayName !== 'string' || value.displayName.trim().length === 0) {
    errors.push('adapter displayName is required')
  }
  if (value.description !== undefined) {
    if (
      typeof value.description !== 'string' ||
      value.description.trim().length === 0 ||
      value.description.length > 1024
    ) {
      errors.push('adapter description must be a non-empty string of at most 1024 characters')
    }
  }
  if (!Number.isInteger(value.contractVersion) || value.contractVersion < 1) {
    errors.push('adapter contractVersion must be a positive integer')
  }
  for (const key of ['platforms', 'searchPlatforms', 'coverHosts']) {
    if (value[key] === undefined) continue
    if (!Array.isArray(value[key]) || !value[key].every((item) => typeof item === 'string')) {
      errors.push(`adapter ${key} must be an array of strings`)
    }
  }
  if (!isPlainObject(manifest.permissions)) {
    errors.push('manifest.permissions is required')
  }

  return errors
}

export function adapterSummary(manifest) {
  const descriptor = adapterDescriptor(manifest)
  const value = descriptor.value
  const permissions = isPlainObject(manifest.permissions) ? manifest.permissions : {}
  return {
    id: descriptor.id,
    name: value.displayName,
    version: manifest.version,
    description: value.description ?? null,
    contractVersion: value.contractVersion,
    platforms: stringList(value.platforms),
    searchPlatforms: stringList(value.searchPlatforms),
    coverHosts: stringList(value.coverHosts),
    permissions: {
      httpHosts: stringList(permissions.httpHosts),
      websocketHosts: stringList(permissions.websocketHosts),
      system: permissions.system === true,
      state: permissions.state === true,
      credentials: permissions.credentials === true,
    },
  }
}
