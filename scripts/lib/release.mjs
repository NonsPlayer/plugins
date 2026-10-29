import { createHash } from 'node:crypto'
import semver from 'semver'
import { manifestSummary, validateManifest } from './manifest.mjs'
import { readManifestFromZip } from './zip.mjs'

export const MAX_ASSET_BYTES = 64 * 1024 * 1024

export function parseTagVersion(tag, pluginId) {
  if (typeof tag !== 'string') return null
  let value = tag.trim()
  if (value.startsWith(`${pluginId}-`)) {
    value = value.slice(pluginId.length + 1)
  }
  if (value.startsWith('v')) {
    value = value.slice(1)
  }
  return semver.valid(value) === null ? null : value
}

export function pickAsset(release, pluginId) {
  const assets = (release.assets ?? []).filter((asset) => {
    if (typeof asset.name !== 'string' || !asset.name.toLowerCase().endsWith('.zip')) return false
    if (typeof asset.size === 'number' && asset.size > MAX_ASSET_BYTES) return false
    return true
  })
  const preferred = assets.filter((asset) => asset.name.startsWith(`${pluginId}-`) || asset.name === `${pluginId}.zip`)
  return preferred[0] ?? assets[0] ?? null
}

function hash(bytes, algorithm) {
  return createHash(algorithm).update(bytes).digest('hex')
}

function releaseHistoryEntry(candidate) {
  return {
    version: candidate.version,
    tag_name: candidate.release.tag_name,
    url: candidate.release.html_url,
    asset_url: candidate.asset.browser_download_url,
    size: candidate.asset.size ?? null,
    created_at: candidate.release.created_at ?? null,
  }
}

export async function resolveLatestRelease({ github, owner, repo, pluginId, maxReleases = 20 }) {
  const releases = await github.listReleases(owner, repo)
  const candidates = []

  for (const release of releases) {
    if (release.draft || release.prerelease) continue
    const version = parseTagVersion(release.tag_name, pluginId)
    if (version === null) continue
    const asset = pickAsset(release, pluginId)
    if (!asset) continue
    candidates.push({ release, version, asset })
  }

  candidates.sort((a, b) => semver.rcompare(a.version, b.version))
  const limited = candidates.slice(0, maxReleases)
  const history = limited.map(releaseHistoryEntry)
  const failures = []

  for (const candidate of limited) {
    try {
      const bytes = await github.download(candidate.asset.browser_download_url)
      if (typeof candidate.asset.size === 'number' && bytes.length !== candidate.asset.size) {
        throw new Error(`asset size mismatch: expected ${candidate.asset.size}, got ${bytes.length}`)
      }
      const manifest = readManifestFromZip(bytes)
      const errors = validateManifest(manifest, pluginId)
      if (errors.length > 0) {
        throw new Error(errors.join('; '))
      }
      if (!semver.eq(manifest.version, candidate.version)) {
        throw new Error(`tag version ${candidate.version} does not match manifest version ${manifest.version}`)
      }
      return {
        release: candidate.release,
        version: candidate.version,
        asset: candidate.asset,
        manifest,
        summary: manifestSummary(manifest),
        sha256: hash(bytes, 'sha256'),
        md5: hash(bytes, 'md5'),
        history,
      }
    } catch (error) {
      failures.push(`${candidate.release.tag_name}: ${error.message}`)
    }
  }

  const detail = failures.length > 0 ? ` (${failures.join('; ')})` : ''
  throw new Error(`no valid release for ${pluginId}${detail}`)
}
