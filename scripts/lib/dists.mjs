import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertSafeRelativePath } from './paths.mjs'

const KINDS = new Set(['plugin', 'adapter'])
const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/
const VERSION_PATTERN = /^[0-9A-Za-z.+-]+$/
const HASH_PATTERN = /^[a-f0-9]{64}$/i

export function normalizeCdnConfig(value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('cdn must be an object')
  }

  const directory = assertSafeRelativePath(value.directory ?? 'dists', 'cdn.directory')
  if (directory === '.') {
    throw new Error('cdn.directory must not be the repository root')
  }

  let url
  try {
    url = new URL(value.baseUrl)
  } catch {
    throw new Error('cdn.baseUrl must be an absolute URL')
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('cdn.baseUrl must be an HTTP(S) URL')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('cdn.baseUrl must not contain credentials, query or fragment')
  }
  if (url.pathname !== '/') {
    throw new Error('cdn.baseUrl must not contain a path')
  }

  return { directory, baseUrl: url.origin }
}

export function distFileName(kind, id, version, sha256) {
  if (!KINDS.has(kind)) throw new Error(`unsupported dist kind: ${kind}`)
  if (!ID_PATTERN.test(id)) throw new Error(`invalid dist id: ${id}`)
  if (!VERSION_PATTERN.test(version)) throw new Error(`invalid dist version: ${version}`)
  if (!HASH_PATTERN.test(sha256)) throw new Error('dist sha256 must be 64 hex characters')
  return `${kind}-${id}-${version}-${sha256.slice(0, 16).toLowerCase()}.zip`
}

export async function writeDist({ directory, kind, id, version, sha256, bytes }) {
  const name = distFileName(kind, id, version, sha256)
  const target = path.join(directory, name)
  const temporary = `${target}.${process.pid}.tmp`
  await mkdir(directory, { recursive: true })
  try {
    await writeFile(temporary, bytes)
    await rename(temporary, target)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
  return name
}

export function distUrl(baseUrl, name) {
  return new URL(name, `${baseUrl}/`).toString()
}
