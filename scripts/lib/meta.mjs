export function buildRecord(kind, registration) {
  return {
    schema_version: 1,
    kind,
    ...(kind === 'adapter' ? { distribution: registration.distribution ?? 'component' } : {}),
    id: registration.id,
    repository: registration.repository,
    branch: registration.branch,
    authors: registration.authors,
    license: registration.license,
    related_path: registration.related_path ?? '.',
    labels: registration.labels ?? [],
    preview: registration.preview ?? null,
    introduction: registration.introduction ?? {},
    deprecated: registration.deprecated ?? false,
    blocked: registration.blocked ?? false,
  }
}

export function buildEntry(kind, registration, resolved) {
  const record = buildRecord(kind, registration)
  const meta = {
    schema_version: 1,
    ...resolved.summary,
  }
  const release = {
    schema_version: 1,
    id: registration.id,
    latest_version: resolved.version,
    latest_version_index: 0,
    releases: [
      {
        url: resolved.release.html_url,
        name: resolved.release.name ?? '',
        tag_name: resolved.release.tag_name,
        created_at: resolved.release.created_at ?? null,
        description: resolved.release.body ?? '',
        prerelease: resolved.release.prerelease === true,
        asset: {
          id: resolved.asset.id,
          name: resolved.asset.name,
          size: resolved.asset.size ?? null,
          download_count: resolved.asset.download_count ?? 0,
          created_at: resolved.asset.created_at ?? null,
          browser_download_url: resolved.asset.browser_download_url,
          hash_md5: resolved.md5,
          hash_sha256: resolved.sha256,
        },
        meta,
      },
    ],
    history: resolved.history,
  }
  return { kind, record, release, meta, all: { record, release, meta } }
}

function indexEntry(entry) {
  const asset = entry.release.releases[0].asset
  const record = entry.record
  const base = {
    id: record.id,
    kind: entry.kind,
    name: entry.meta.name,
    version: entry.meta.version,
    description: entry.meta.description,
    authors: record.authors,
    license: record.license,
    repository: record.repository,
    labels: record.labels,
    preview: record.preview,
    deprecated: record.deprecated,
    blocked: record.blocked,
    unavailable: false,
    artifact: {
      url: asset.browser_download_url,
      size: asset.size,
      sha256: asset.hash_sha256,
      md5: asset.hash_md5,
    },
    release: {
      tag: entry.release.releases[0].tag_name,
      created_at: entry.release.releases[0].created_at,
    },
  }
  if (entry.kind === 'adapter') {
    if (record.distribution === 'source') {
      const { artifact, ...source } = base
      return {
        ...source,
        distribution: 'source',
        installable: false,
        artifact: null,
        sourceArtifact: artifact,
      }
    }
    return {
      ...base,
      distribution: 'component',
      installable: true,
      contractVersion: entry.meta.contractVersion,
      platforms: entry.meta.platforms ?? [],
      searchPlatforms: entry.meta.searchPlatforms ?? [],
      coverHosts: entry.meta.coverHosts ?? [],
      permissions: entry.meta.permissions ?? {},
    }
  }
  return {
    ...base,
    engines: entry.meta.engines,
    permissions: entry.meta.permissions,
    httpHosts: entry.meta.httpHosts ?? [],
    fileRoots: entry.meta.fileRoots ?? [],
  }
}

export function buildIndex(entries, { generatedAt = new Date().toISOString() } = {}) {
  const byKind = (kind) =>
    entries
      .filter((entry) => entry.kind === kind)
      .sort((a, b) => a.record.id.localeCompare(b.record.id))
      .map(indexEntry)
  return {
    schema_version: 1,
    generated_at: generatedAt,
    plugins: byKind('plugin'),
    adapters: byKind('adapter'),
  }
}

export function buildAuthors(entries) {
  const authors = new Map()
  for (const entry of entries) {
    for (const author of entry.record.authors) {
      const key = author.name
      if (!authors.has(key)) {
        authors.set(key, { name: key, links: new Set(), plugins: new Set(), adapters: new Set() })
      }
      const item = authors.get(key)
      if (author.link) item.links.add(author.link)
      item[entry.kind === 'adapter' ? 'adapters' : 'plugins'].add(entry.record.id)
    }
  }
  return Object.fromEntries(
    [...authors.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [
        key,
        {
          name: value.name,
          links: [...value.links].sort(),
          plugins: [...value.plugins].sort(),
          adapters: [...value.adapters].sort(),
        },
      ]),
  )
}
